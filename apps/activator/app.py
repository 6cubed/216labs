import json
import os
import re
import sqlite3
import subprocess
import threading
import time
from datetime import datetime, timezone
from typing import Dict
from urllib import request as urlrequest

from flask import Flask, jsonify, request

app = Flask(__name__)
# v2: POST /api/start JSON errors + sqlite runtime columns optional

PROJECT_ROOT = os.environ.get("ACTIVATOR_PROJECT_ROOT", "/workspace")
DB_PATH = os.environ.get("ACTIVATOR_DB_PATH", os.path.join(PROJECT_ROOT, "216labs.db"))
APP_HOST = os.environ.get("APP_HOST", "6cubed.app")
START_TIMEOUT_SECONDS = int(os.environ.get("ACTIVATOR_START_TIMEOUT_SECONDS", "45"))
DEPLOY_TRIGGER_URL = os.environ.get("ACTIVATOR_DEPLOY_TRIGGER_URL", "").strip()
DEPLOY_TRIGGER_TOKEN = os.environ.get("ACTIVATOR_DEPLOY_TRIGGER_TOKEN", "").strip()

_status_lock = threading.Lock()
_status: Dict[str, Dict[str, object]] = {}
_locks: Dict[str, threading.Lock] = {}
_APP_ID_RE = re.compile(r"^[a-z0-9][a-z0-9.-]*$")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def get_lock(app_id: str) -> threading.Lock:
    with _status_lock:
        lock = _locks.get(app_id)
        if lock is None:
            lock = threading.Lock()
            _locks[app_id] = lock
        return lock


def set_status(app_id: str, phase: str, message: str = "", **extra: object) -> Dict[str, object]:
    row = {
        "app_id": app_id,
        "phase": phase,
        "message": message,
        "updated_at": utc_now(),
        **extra,
    }
    with _status_lock:
        _status[app_id] = row
    return row


def get_status(app_id: str) -> Dict[str, object]:
    with _status_lock:
        row = _status.get(app_id)
    if row:
        return row
    return set_status(app_id, "idle", "Awaiting start request.")


def db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_app_row(app_id: str):
    with db_connection() as conn:
        row = conn.execute(
            "SELECT id, docker_service FROM apps WHERE id = ?",
            (app_id,),
        ).fetchone()
    return row


def set_runtime_state(
    app_id: str,
    status: str,
    last_runtime_error: str = "",
    touch_started: bool = False,
    touch_accessed: bool = False,
) -> None:
    fields = ["runtime_status = ?", "last_runtime_error = ?"]
    values = [status, last_runtime_error]
    if touch_started:
        fields.append("last_started_at = datetime('now')")
    if touch_accessed:
        fields.append("last_accessed_at = datetime('now')")
    values.append(app_id)
    try:
        with db_connection() as conn:
            conn.execute(f"UPDATE apps SET {', '.join(fields)} WHERE id = ?", values)
            conn.commit()
    except sqlite3.OperationalError:
        # Older 216labs.db without activator columns — continue; in-memory status still works.
        pass


def run_compose(*args: str) -> subprocess.CompletedProcess:
    cmd = [
        "docker",
        "compose",
        "--env-file",
        ".env",
        "--env-file",
        ".env.admin",
        *args,
    ]
    return subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def compose_running(docker_service: str) -> bool:
    ps = run_compose("ps", "--status", "running", "--services", docker_service)
    if ps.returncode != 0:
        return False
    return docker_service in ps.stdout.split()


def try_pull_image(docker_service: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["docker", "pull", f"216labs/{docker_service}:latest"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


def trigger_remote_deploy(app_id: str, docker_service: str) -> bool:
    if not DEPLOY_TRIGGER_URL:
        return False
    payload = json.dumps({"app_id": app_id, "docker_service": docker_service}).encode("utf-8")
    req = urlrequest.Request(
        DEPLOY_TRIGGER_URL,
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    if DEPLOY_TRIGGER_TOKEN:
        req.add_header("Authorization", f"Bearer {DEPLOY_TRIGGER_TOKEN}")
    try:
        with urlrequest.urlopen(req, timeout=10) as response:
            return 200 <= response.status < 300
    except Exception:
        return False


def start_app(app_id: str) -> Dict[str, object]:
    row = get_app_row(app_id)
    if row is None:
        status = set_status(app_id, "failed", "Unknown app ID.")
        return {"ok": False, "status": status}

    docker_service = row["docker_service"]
    app_lock = get_lock(app_id)
    if not app_lock.acquire(blocking=False):
        status = get_status(app_id)
        return {"ok": False, "status": status, "queued": True}

    try:
        set_runtime_state(app_id, "starting", "", touch_accessed=True)
        set_status(app_id, "starting", "Starting container.", docker_service=docker_service)

        if compose_running(docker_service):
            set_runtime_state(app_id, "ready", "", touch_accessed=True)
            status = set_status(app_id, "ready", "App already running.", docker_service=docker_service)
            return {"ok": True, "status": status}

        up = run_compose("up", "-d", "--no-build", docker_service)
        if up.returncode != 0:
            pull = try_pull_image(docker_service)
            if pull.returncode == 0:
                up = run_compose("up", "-d", "--no-build", docker_service)

        if up.returncode != 0:
            deployed = trigger_remote_deploy(app_id, docker_service)
            if deployed:
                set_runtime_state(app_id, "deploying", up.stderr.strip(), touch_accessed=True)
                status = set_status(
                    app_id,
                    "deploying",
                    "Image missing locally; external deploy trigger accepted.",
                    docker_service=docker_service,
                )
                return {"ok": False, "status": status}
            err = up.stderr.strip() or up.stdout.strip() or "Container start failed."
            set_runtime_state(app_id, "failed", err, touch_accessed=True)
            status = set_status(app_id, "failed", err, docker_service=docker_service)
            return {"ok": False, "status": status}

        deadline = time.time() + START_TIMEOUT_SECONDS
        while time.time() < deadline:
            if compose_running(docker_service):
                set_runtime_state(app_id, "ready", "", touch_started=True, touch_accessed=True)
                status = set_status(
                    app_id,
                    "ready",
                    "Container is running.",
                    docker_service=docker_service,
                )
                return {"ok": True, "status": status}
            time.sleep(1)

        msg = "Container did not report running before timeout."
        set_runtime_state(app_id, "failed", msg, touch_accessed=True)
        status = set_status(app_id, "failed", msg, docker_service=docker_service)
        return {"ok": False, "status": status}
    except Exception as e:
        st = set_status(app_id, "failed", str(e))
        return {"ok": False, "status": st}
    finally:
        app_lock.release()


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True, "service": "activator"})


@app.get("/api/status/<app_id>")
def status(app_id: str):
    if not _APP_ID_RE.match(app_id):
        return jsonify({"error": "Invalid app id"}), 400
    row = get_app_row(app_id)
    if row is None:
        return jsonify({"error": "Unknown app id"}), 404
    touch_access = request.args.get("touch") == "1"
    if touch_access:
        set_runtime_state(app_id, "idle", "", touch_accessed=True)
    return jsonify(get_status(app_id))


@app.post("/api/start/<app_id>")
def start(app_id: str):
    if not _APP_ID_RE.match(app_id):
        return jsonify({"error": "Invalid app id"}), 400
    result = start_app(app_id)
    code = 200 if result.get("ok") else 202 if result.get("queued") else 503
    return jsonify(result["status"]), code


@app.get("/warmup")
def warmup():
    app_id = (request.args.get("app") or "").strip()
    if not _APP_ID_RE.match(app_id):
        return "Invalid app id.", 400

    dest = (request.args.get("dest") or f"https://{app_id}.{APP_HOST}").strip()
    safe_dest = json.dumps(dest)
    safe_app = json.dumps(app_id)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Warming up {app_id}</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }}
    .box {{ max-width: 560px; margin: 18vh auto; padding: 28px; background: #111827; border: 1px solid #1f2937; border-radius: 12px; }}
    h1 {{ margin-top: 0; font-size: 1.2rem; }}
    p {{ color: #cbd5e1; line-height: 1.5; }}
    .muted {{ color: #94a3b8; font-size: 0.9rem; }}
  </style>
</head>
<body>
  <div class="box">
    <h1>Warming up {app_id}</h1>
    <p>This app is currently cold. We are starting its container now. You will be redirected automatically.</p>
    <p id="status" class="muted">Starting...</p>
  </div>
  <script>
    const appId = {safe_app};
    const destination = {safe_dest};
    const statusEl = document.getElementById("status");

    async function start() {{
      try {{
        await fetch(`/api/start/${{encodeURIComponent(appId)}}`, {{ method: "POST" }});
      }} catch (_err) {{
        // Keep polling status even if start request races with another request.
      }}
    }}

    async function poll() {{
      try {{
        const res = await fetch(`/api/status/${{encodeURIComponent(appId)}}?touch=1`);
        const data = await res.json();
        statusEl.textContent = data.message || data.phase || "Starting...";
        if (data.phase === "ready") {{
          window.location.replace(destination);
          return;
        }}
        if (data.phase === "failed") {{
          statusEl.textContent = `Failed: ${{data.message || "unknown error"}}`;
          return;
        }}
      }} catch (_err) {{
        statusEl.textContent = "Waiting for activator...";
      }}
      setTimeout(poll, 1500);
    }}

    start();
    poll();
  </script>
</body>
</html>"""


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "3040")))
# bump: error handling for start + sqlite runtime columns
