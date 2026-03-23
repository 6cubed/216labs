import base64
import json
import os
import re
import sqlite3
import subprocess
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple
import urllib.error
from urllib.parse import urlparse
from urllib import request as urlrequest

from flask import Flask, jsonify, request

app = Flask(__name__)
# v4: LRU off by default; landing protected — avoids evicting when browsing many apps

PROJECT_ROOT = os.environ.get("ACTIVATOR_PROJECT_ROOT", "/workspace")
DB_PATH = os.environ.get("ACTIVATOR_DB_PATH", os.path.join(PROJECT_ROOT, "216labs.db"))
APP_HOST = os.environ.get("APP_HOST", "6cubed.app")
START_TIMEOUT_SECONDS = int(os.environ.get("ACTIVATOR_START_TIMEOUT_SECONDS", "120"))
DEPLOY_TRIGGER_URL = os.environ.get("ACTIVATOR_DEPLOY_TRIGGER_URL", "").strip()
DEPLOY_TRIGGER_TOKEN = os.environ.get("ACTIVATOR_DEPLOY_TRIGGER_TOKEN", "").strip()

# 0 = unlimited (legacy). Set e.g. 10 on a 1GB droplet so only N app containers stay up.
MAX_CONCURRENT_APPS = int(os.environ.get("ACTIVATOR_MAX_CONCURRENT_APPS", "0"))
REAPER_INTERVAL_SECONDS = int(os.environ.get("ACTIVATOR_REAPER_INTERVAL_SECONDS", "120"))
REMOVE_IMAGE_ON_EVICT = os.environ.get("ACTIVATOR_REMOVE_IMAGE_ON_EVICT", "").strip().lower() in (
    "1",
    "true",
    "yes",
)
# 216labs/* images are not on Docker Hub; deploy transfers them. Optional registry pull.
TRY_DOCKER_PULL = os.environ.get("ACTIVATOR_TRY_DOCKER_PULL", "").strip().lower() in (
    "1",
    "true",
    "yes",
)
# e.g. ghcr.io/6cubed/216labs — cold-start pulls then retags to 216labs/<service>:latest
REGISTRY_PREFIX = os.environ.get("ACTIVATOR_REGISTRY_PREFIX", "").strip()
GHCR_TOKEN = os.environ.get("GHCR_TOKEN", "").strip()
GHCR_USERNAME = os.environ.get("GHCR_USERNAME", "token").strip() or "token"


def _parse_protected_services() -> Set[str]:
    raw = os.environ.get("ACTIVATOR_PROTECTED_SERVICES", "caddy,activator,admin,landing")
    return {x.strip().lower() for x in raw.split(",") if x.strip()}


PROTECTED_DOCKER_SERVICES = _parse_protected_services()


def _parse_block_start_services() -> Set[str]:
    raw = os.environ.get("ACTIVATOR_BLOCK_START_SERVICES", "caddy,activator")
    return {x.strip().lower() for x in raw.split(",") if x.strip()}


# Never start via warmup/API — avoids breaking the edge or recursion.
BLOCK_START_DOCKER_SERVICES = _parse_block_start_services()

_status_lock = threading.Lock()
_status: Dict[str, Dict[str, object]] = {}
_locks: Dict[str, threading.Lock] = {}
_eviction_lock = threading.Lock()
_APP_ID_RE = re.compile(r"^[a-z0-9][a-z0-9.-]*$")


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def normalize_app_id(raw: str) -> Optional[str]:
    """Lowercase app id from URL/query; None if invalid (Caddy uses lowercase; tolerates mixed case)."""
    s = (raw or "").strip().lower()
    if not s or not _APP_ID_RE.match(s):
        return None
    return s


def safe_warmup_dest(dest: Optional[str], app_id: str) -> str:
    """Only allow https://{app_id}.{APP_HOST}[...] to prevent open redirects."""
    default = f"https://{app_id}.{APP_HOST}"
    if not dest or not str(dest).strip():
        return default
    dest_s = str(dest).strip()
    try:
        u = urlparse(dest_s)
    except Exception:
        return default
    if u.scheme != "https":
        return default
    host = (u.hostname or "").lower()
    expected = f"{app_id.lower()}.{APP_HOST.lower()}"
    if host == expected:
        return dest_s
    return default


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


def _manifest_search_dirs() -> List[str]:
    """Directories that may contain manifest.json (aligned with scripts/app-lookup.py)."""
    dirs: List[str] = []
    try:
        for entry in os.listdir(PROJECT_ROOT):
            if entry.startswith(".") or entry in ("scripts", "apps"):
                continue
            path = os.path.join(PROJECT_ROOT, entry)
            if os.path.isdir(path):
                dirs.append(path)
    except OSError:
        pass
    apps_dir = os.path.join(PROJECT_ROOT, "apps")
    try:
        if os.path.isdir(apps_dir):
            for entry in os.listdir(apps_dir):
                if entry.startswith("."):
                    continue
                path = os.path.join(apps_dir, entry)
                if os.path.isdir(path):
                    dirs.append(path)
    except OSError:
        pass
    return dirs


def load_manifest_for_app(app_id: str) -> Optional[dict]:
    """Load manifest.json for app_id from the repo (no admin DB row required)."""
    for d in _manifest_search_dirs():
        mp = os.path.join(d, "manifest.json")
        if not os.path.isfile(mp):
            continue
        try:
            with open(mp, encoding="utf-8") as f:
                m = json.load(f)
            if m.get("id") == app_id:
                return m
        except (OSError, json.JSONDecodeError):
            continue
    return None


def get_internal_http_port(app_id: str) -> int:
    """Container listen port from manifest (matches Caddy reverse_proxy target)."""
    m = load_manifest_for_app(app_id)
    if m:
        try:
            p = int(m.get("internal_port", 3000))
            if p > 0:
                return p
        except (TypeError, ValueError):
            pass
    return 3000


def http_upstream_ready(docker_service: str, port: int, timeout: float = 2.5) -> bool:
    """True when something accepts HTTP on the compose service (avoids Caddy↔warmup redirect loops)."""
    per_path = max(0.9, min(timeout, 4.0) / 2)
    headers = {"Connection": "close", "User-Agent": "activator-health/1.0"}
    for path in ("/", "/healthz"):
        url = f"http://{docker_service}:{port}{path}"
        try:
            req = urlrequest.Request(url, headers=headers)
            with urlrequest.urlopen(req, timeout=per_path) as _resp:
                return True
        except urllib.error.HTTPError:
            # Any HTTP response means the socket is up (4xx/5xx still listening).
            return True
        except Exception:
            continue
    return False


def resolve_docker_service(app_id: str) -> Optional[str]:
    """Compose service name from admin DB, else from on-disk manifest (HTTP apps only)."""
    row = get_app_row(app_id)
    if row is not None:
        return str(row["docker_service"])
    m = load_manifest_for_app(app_id)
    if m is None:
        return None
    try:
        p = int(m.get("internal_port", 3000))
        if p <= 0:
            return None
    except (TypeError, ValueError):
        pass
    return str(m.get("docker_service", app_id))


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


def touch_last_accessed_only(app_id: str) -> None:
    try:
        with db_connection() as conn:
            conn.execute(
                "UPDATE apps SET last_accessed_at = datetime('now') WHERE id = ?",
                (app_id,),
            )
            conn.commit()
    except sqlite3.OperationalError:
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
    env = os.environ.copy()
    # Compose defaults project name to the cwd basename; ACTIVATOR_PROJECT_ROOT is /workspace in production,
    # which would create a separate "workspace_*" stack invisible to Caddy on the 216labs network.
    if env.get("ACTIVATOR_PROJECT_ROOT", "").rstrip("/") == "/workspace":
        env.setdefault("COMPOSE_PROJECT_NAME", "216labs")
    return subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
        env=env,
    )


def compose_running(docker_service: str) -> bool:
    ps = run_compose("ps", "--status", "running", "--services", docker_service)
    if ps.returncode != 0:
        return False
    return docker_service in ps.stdout.split()


def docker_service_to_app_id(docker_service: str) -> Optional[str]:
    try:
        with db_connection() as conn:
            row = conn.execute(
                "SELECT id FROM apps WHERE docker_service = ? LIMIT 1",
                (docker_service,),
            ).fetchone()
        return str(row["id"]) if row else None
    except sqlite3.OperationalError:
        return None


def get_last_accessed_at(app_id: str) -> Optional[str]:
    try:
        with db_connection() as conn:
            row = conn.execute(
                "SELECT last_accessed_at FROM apps WHERE id = ?",
                (app_id,),
            ).fetchone()
        if row is None:
            return None
        v = row["last_accessed_at"]
        return str(v) if v is not None else None
    except sqlite3.OperationalError:
        return None


def pick_lru_eviction_target(
    candidates: List[Tuple[str, str, Optional[str]]],
) -> Optional[str]:
    """Pick docker_service with oldest last_accessed_at (None/'' treated as oldest)."""
    if not candidates:
        return None
    ranked = sorted(candidates, key=lambda t: (t[2] or ""))
    return ranked[0][0]


def running_compose_services() -> List[str]:
    ps = run_compose("ps", "--status", "running", "--services")
    if ps.returncode != 0:
        return []
    return [s.strip() for s in ps.stdout.splitlines() if s.strip()]


def get_evictable_running_candidates() -> List[Tuple[str, str, Optional[str]]]:
    """(docker_service, app_id, last_accessed_at) for running evictable compose services."""
    out: List[Tuple[str, str, Optional[str]]] = []
    for svc in running_compose_services():
        if svc.lower() in PROTECTED_DOCKER_SERVICES:
            continue
        aid = docker_service_to_app_id(svc)
        if not aid:
            continue
        out.append((svc, aid, get_last_accessed_at(aid)))
    return out


def evict_docker_service(docker_service: str) -> None:
    app_id = docker_service_to_app_id(docker_service)
    run_compose("stop", "-t", "15", docker_service)
    if app_id:
        set_runtime_state(app_id, "cold", "LRU eviction", touch_accessed=False)
    if REMOVE_IMAGE_ON_EVICT:
        subprocess.run(
            ["docker", "rmi", "-f", f"216labs/{docker_service}:latest"],
            cwd=PROJECT_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )


def evict_until_under_limit(max_slots: int) -> None:
    """Ensure fewer than max_slots evictable app containers are running."""
    if max_slots <= 0:
        return
    with _eviction_lock:
        while True:
            candidates = get_evictable_running_candidates()
            if len(candidates) < max_slots:
                return
            victim = pick_lru_eviction_target(candidates)
            if not victim:
                return
            evict_docker_service(victim)


def reaper_loop() -> None:
    while True:
        time.sleep(max(30, REAPER_INTERVAL_SECONDS))
        try:
            if MAX_CONCURRENT_APPS <= 0:
                continue
            with _eviction_lock:
                while True:
                    candidates = get_evictable_running_candidates()
                    if len(candidates) <= MAX_CONCURRENT_APPS:
                        break
                    victim = pick_lru_eviction_target(candidates)
                    if not victim:
                        break
                    evict_docker_service(victim)
        except Exception:
            pass


def _docker_cmd_env_for_ghcr() -> dict[str, str]:
    """Set DOCKER_AUTH_CONFIG for ghcr.io when GHCR_TOKEN is set (read:packages PAT)."""
    env = os.environ.copy()
    if not GHCR_TOKEN:
        return env
    auth = base64.b64encode(f"{GHCR_USERNAME}:{GHCR_TOKEN}".encode()).decode()
    cfg = {"auths": {"ghcr.io": {"auth": auth}}}
    env["DOCKER_AUTH_CONFIG"] = json.dumps(cfg)
    return env


def try_registry_pull(docker_service: str) -> bool:
    """Pull ACTIVATOR_REGISTRY_PREFIX/<service>:latest and retag to 216labs/<service>:latest."""
    if not REGISTRY_PREFIX:
        return False
    remote = f"{REGISTRY_PREFIX.rstrip('/')}/{docker_service}:latest"
    local = f"216labs/{docker_service}:latest"
    env = _docker_cmd_env_for_ghcr()
    pull = subprocess.run(
        ["docker", "pull", remote],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
        env=env,
    )
    if pull.returncode != 0:
        return False
    tag = subprocess.run(
        ["docker", "tag", remote, local],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
        env=env,
    )
    return tag.returncode == 0


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
    docker_service = resolve_docker_service(app_id)
    if docker_service is None:
        status = set_status(
            app_id,
            "failed",
            "Unknown app ID (not in admin DB and no matching manifest with HTTP port).",
        )
        return {"ok": False, "status": status}

    if docker_service.lower() in BLOCK_START_DOCKER_SERVICES:
        msg = "This compose service cannot be started via the activator (edge infrastructure)."
        set_runtime_state(app_id, "failed", msg, touch_accessed=True)
        status = set_status(app_id, "failed", msg, docker_service=docker_service)
        return {"ok": False, "status": status}

    app_lock = get_lock(app_id)
    if not app_lock.acquire(blocking=False):
        status = get_status(app_id)
        return {"ok": False, "status": status, "queued": True}

    try:
        internal_port = get_internal_http_port(app_id)
        set_runtime_state(app_id, "starting", "", touch_accessed=True)
        set_status(app_id, "starting", "Starting container.", docker_service=docker_service)

        if MAX_CONCURRENT_APPS > 0:
            evict_until_under_limit(MAX_CONCURRENT_APPS)

        if compose_running(docker_service) and http_upstream_ready(
            docker_service, internal_port
        ):
            set_runtime_state(app_id, "ready", "", touch_accessed=True)
            status = set_status(
                app_id,
                "ready",
                "App already serving.",
                docker_service=docker_service,
            )
            return {"ok": True, "status": status}

        up = run_compose("up", "-d", "--no-build", docker_service)
        if up.returncode != 0 and try_registry_pull(docker_service):
            up = run_compose("up", "-d", "--no-build", docker_service)
        if up.returncode != 0 and TRY_DOCKER_PULL:
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
            low = err.lower()
            if "no such image" in low or "pull access denied" in low or "pulling" in low:
                err = (
                    f"{err} — Image 216labs/{docker_service}:latest must exist on the droplet. "
                    f"Run ./deploy.sh from a machine that has the image locally (deploy syncs missing tags); "
                    f"do not build on the server."
                )
            set_runtime_state(app_id, "failed", err, touch_accessed=True)
            status = set_status(app_id, "failed", err, docker_service=docker_service)
            return {"ok": False, "status": status}

        deadline = time.time() + START_TIMEOUT_SECONDS
        while time.time() < deadline:
            if compose_running(docker_service) and http_upstream_ready(
                docker_service, internal_port
            ):
                set_runtime_state(app_id, "ready", "", touch_started=True, touch_accessed=True)
                status = set_status(
                    app_id,
                    "ready",
                    "App is serving HTTP.",
                    docker_service=docker_service,
                )
                return {"ok": True, "status": status}
            if compose_running(docker_service):
                set_status(
                    app_id,
                    "starting",
                    "Container up; waiting for HTTP…",
                    docker_service=docker_service,
                )
            time.sleep(0.5)

        msg = "Container did not become reachable over HTTP before timeout."
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
    return jsonify(
        {
            "ok": True,
            "service": "activator",
            "max_concurrent_apps": MAX_CONCURRENT_APPS,
            "lru_enabled": MAX_CONCURRENT_APPS > 0,
            "manifest_fallback": True,
            "registry_prefix": REGISTRY_PREFIX or None,
            "ghcr_auth_configured": bool(GHCR_TOKEN),
            "block_start_services": sorted(BLOCK_START_DOCKER_SERVICES),
        }
    )


@app.get("/api/status/<app_id>")
def status(app_id: str):
    app_id = normalize_app_id(app_id) or ""
    if not app_id:
        return jsonify({"error": "Invalid app id"}), 400
    if resolve_docker_service(app_id) is None:
        return jsonify({"error": "Unknown app id"}), 404
    touch_access = request.args.get("touch") == "1"
    if touch_access:
        set_runtime_state(app_id, "idle", "", touch_accessed=True)
    return jsonify(get_status(app_id))


@app.post("/api/start/<app_id>")
def start(app_id: str):
    app_id = normalize_app_id(app_id) or ""
    if not app_id:
        return jsonify({"error": "Invalid app id"}), 400
    result = start_app(app_id)
    code = 200 if result.get("ok") else 202 if result.get("queued") else 503
    return jsonify(result["status"]), code


@app.post("/api/touch/<app_id>")
def touch(app_id: str):
    """Optional: mark last_accessed_at for LRU (e.g. future Caddy subrequest or cron)."""
    app_id = normalize_app_id(app_id) or ""
    if not app_id:
        return jsonify({"error": "Invalid app id"}), 400
    if resolve_docker_service(app_id) is None:
        return jsonify({"error": "Unknown app id"}), 404
    touch_last_accessed_only(app_id)
    return "", 204


@app.get("/warmup")
def warmup():
    app_id = normalize_app_id(request.args.get("app") or "")
    if not app_id:
        return "Invalid app id.", 400
    if resolve_docker_service(app_id) is None:
        return (
            "<!doctype html><html><body><p>Unknown app. Not in admin DB and no manifest found.</p></body></html>",
            404,
        )

    dest = safe_warmup_dest(request.args.get("dest"), app_id)
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
    const bounceKey = "warmup_bounce_" + appId;
    let bounced = JSON.parse(sessionStorage.getItem(bounceKey) || '{{"n":0,"t":0}}');
    if (Date.now() - bounced.t > 300000) bounced = {{ n: 0, t: Date.now() }};

    if (bounced.n >= 5) {{
      statusEl.textContent = "This page reloaded too many times while the app stayed unreachable. Wait a minute, then try the site again.";
    }} else {{
      bounced.n += 1;
      bounced.t = Date.now();
      sessionStorage.setItem(bounceKey, JSON.stringify(bounced));

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
    }}
  </script>
</body>
</html>"""


if __name__ == "__main__":
    if REAPER_INTERVAL_SECONDS > 0 and MAX_CONCURRENT_APPS > 0:
        t = threading.Thread(target=reaper_loop, name="activator-reaper", daemon=True)
        t.start()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "3040")))
