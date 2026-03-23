import json
import os
import threading
import time
from pathlib import Path
from typing import Any

import requests
from flask import Flask, jsonify, redirect, render_template_string, request, url_for

app = Flask(__name__)

DATA_DIR = Path(os.environ.get("POCKETCURSOR_DATA_DIR", "/app/data"))
CONFIG_PATH = DATA_DIR / "bridge_config.json"

TELEGRAM_API = "https://api.telegram.org"
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
BOOT_CHAT_ID = os.environ.get("POCKETCURSOR_BRIDGE_CHAT_ID", "").strip()

DEFAULT_CONFIG = {
    "require_whitelist": os.environ.get("POCKETCURSOR_REQUIRE_WHITELIST", "true").lower()
    in ("1", "true", "yes", "on"),
    "allowed_usernames": [
        x.strip().lstrip("@").lower()
        for x in os.environ.get("POCKETCURSOR_ALLOWED_TELEGRAM_NAMES", "").split(",")
        if x.strip()
    ],
    "allowed_user_ids": [
        int(x.strip())
        for x in os.environ.get("POCKETCURSOR_ALLOWED_TELEGRAM_IDS", "").split(",")
        if x.strip().isdigit()
    ],
    "verbosity": (os.environ.get("POCKETCURSOR_VERBOSITY", "normal").strip().lower() or "normal"),
}

state_lock = threading.Lock()
runtime_state: dict[str, Any] = {
    "running": True,
    "last_update_id": None,
    "bridge_events": [],
}


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict[str, Any]:
    ensure_data_dir()
    if not CONFIG_PATH.exists():
        save_config(DEFAULT_CONFIG)
        return dict(DEFAULT_CONFIG)
    try:
        parsed = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        cfg = dict(DEFAULT_CONFIG)
        cfg.update(parsed if isinstance(parsed, dict) else {})
        cfg["allowed_usernames"] = [
            str(x).strip().lstrip("@").lower()
            for x in cfg.get("allowed_usernames", [])
            if str(x).strip()
        ]
        cfg["allowed_user_ids"] = [
            int(x) for x in cfg.get("allowed_user_ids", []) if str(x).isdigit()
        ]
        if cfg.get("verbosity") not in ("quiet", "normal", "verbose"):
            cfg["verbosity"] = "normal"
        return cfg
    except Exception:
        return dict(DEFAULT_CONFIG)


def save_config(cfg: dict[str, Any]) -> None:
    ensure_data_dir()
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf-8")


def tg_call(method: str, **kwargs: Any) -> dict[str, Any] | None:
    if not BOT_TOKEN:
        return None
    try:
        res = requests.post(
            f"{TELEGRAM_API}/bot{BOT_TOKEN}/{method}",
            data=kwargs,
            timeout=30,
        )
        data = res.json()
        return data if data.get("ok") else None
    except Exception:
        return None


def log_event(text: str, level: str = "normal") -> None:
    cfg = load_config()
    verbosity = cfg.get("verbosity", "normal")
    if verbosity == "quiet" and level == "verbose":
        return
    if verbosity == "normal" and level == "verbose":
        return
    with state_lock:
        runtime_state["bridge_events"].append({"ts": int(time.time()), "text": text})
        runtime_state["bridge_events"] = runtime_state["bridge_events"][-200:]


def user_is_allowed(cfg: dict[str, Any], user: dict[str, Any]) -> bool:
    if not cfg.get("require_whitelist", True):
        return True
    user_id = user.get("id")
    username = (user.get("username") or "").strip().lower()
    if user_id in cfg.get("allowed_user_ids", []):
        return True
    if username and username in cfg.get("allowed_usernames", []):
        return True
    return False


def bridge_loop() -> None:
    if not BOT_TOKEN:
        log_event("TELEGRAM_BOT_TOKEN missing; bridge worker idle.")
        return

    offset = None
    while True:
        with state_lock:
            if not runtime_state["running"]:
                break
        updates = tg_call("getUpdates", timeout=25, offset=offset)
        if not updates:
            time.sleep(1)
            continue
        for upd in updates.get("result", []):
            update_id = upd.get("update_id")
            if update_id is not None:
                offset = int(update_id) + 1
            msg = upd.get("message") or {}
            if not msg:
                continue
            chat = msg.get("chat", {})
            user = msg.get("from", {})
            text = (msg.get("text") or "").strip()
            cfg = load_config()
            chat_id = str(chat.get("id", ""))

            if BOOT_CHAT_ID and chat_id and chat_id != BOOT_CHAT_ID:
                log_event(f"Ignored message from chat {chat_id} (bound to {BOOT_CHAT_ID}).", "verbose")
                continue
            if not user_is_allowed(cfg, user):
                log_event(
                    f"Rejected {user.get('username') or user.get('id')} in chat {chat_id}.",
                    "normal",
                )
                continue

            if text.startswith("/start"):
                tg_call(
                    "sendMessage",
                    chat_id=chat_id,
                    text=(
                        "PocketCursor bridge is online.\n"
                        f"Whitelist mode: {'on' if cfg.get('require_whitelist') else 'off'}\n"
                        f"Verbosity: {cfg.get('verbosity')}"
                    ),
                )
                continue

            if text:
                # Placeholder forward path for repo-integrated bridge:
                # Keep a clear audit trail while we migrate deeper Cursor CDP hooks.
                log_event(
                    f"Accepted message from {user.get('username') or user.get('id')}: {text[:160]}",
                    "normal",
                )
                tg_call(
                    "sendMessage",
                    chat_id=chat_id,
                    text=(
                        "PocketCursor bridge received your message. "
                        "The monorepo bridge now supports multi-user auth policy."
                    ),
                )


ADMIN_HTML = """
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>PocketCursor Bridge Admin</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem auto; max-width: 900px; color: #111; }
      h1 { margin-bottom: .25rem; }
      .muted { color: #666; font-size: .92rem; }
      form, .card { border: 1px solid #ddd; border-radius: 12px; padding: 1rem; margin-top: 1rem; }
      textarea, input, select { width: 100%; padding: .5rem; margin-top: .3rem; }
      button { margin-top: 1rem; padding: .6rem 1rem; }
      code { background: #f6f6f6; padding: .1rem .3rem; border-radius: 4px; }
      .ok { color: #0b7a38; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>PocketCursor Bridge Admin</h1>
    <p class="muted">Configure Telegram group policy (whitelist + verbosity) at runtime.</p>
    {% if saved %}
      <p class="ok">Saved.</p>
    {% endif %}
    <form method="post" action="{{ url_for('save_admin') }}">
      <label>Whitelist required</label>
      <select name="require_whitelist">
        <option value="true" {% if cfg.require_whitelist %}selected{% endif %}>true</option>
        <option value="false" {% if not cfg.require_whitelist %}selected{% endif %}>false</option>
      </select>

      <label>Allowed Telegram usernames (comma-separated, no @ needed)</label>
      <input name="allowed_usernames" value="{{ cfg.allowed_usernames|join(', ') }}" />

      <label>Allowed Telegram user IDs (comma-separated)</label>
      <input name="allowed_user_ids" value="{{ cfg.allowed_user_ids|join(', ') }}" />

      <label>Verbosity</label>
      <select name="verbosity">
        {% for v in ['quiet', 'normal', 'verbose'] %}
          <option value="{{ v }}" {% if cfg.verbosity == v %}selected{% endif %}>{{ v }}</option>
        {% endfor %}
      </select>

      <button type="submit">Save bridge config</button>
    </form>

    <div class="card">
      <h3>Bridge status</h3>
      <p class="muted">Chat binding: <code>{{ chat_id or 'not set' }}</code></p>
      <p class="muted">Token configured: <code>{{ token_state }}</code></p>
      <p class="muted">Recent events shown below (latest first).</p>
      <pre style="white-space: pre-wrap;">{{ events }}</pre>
    </div>
  </body>
</html>
"""


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/api/config")
def api_config():
    return jsonify(load_config())


@app.post("/api/config")
def api_save_config():
    payload = request.get_json(force=True, silent=True) or {}
    cfg = load_config()
    cfg["require_whitelist"] = bool(payload.get("require_whitelist", cfg["require_whitelist"]))
    if "allowed_usernames" in payload:
        cfg["allowed_usernames"] = [
            str(x).strip().lstrip("@").lower()
            for x in payload.get("allowed_usernames", [])
            if str(x).strip()
        ]
    if "allowed_user_ids" in payload:
        cfg["allowed_user_ids"] = [
            int(x)
            for x in payload.get("allowed_user_ids", [])
            if str(x).isdigit()
        ]
    if payload.get("verbosity") in ("quiet", "normal", "verbose"):
        cfg["verbosity"] = payload["verbosity"]
    save_config(cfg)
    return jsonify({"ok": True, "config": cfg})


@app.get("/")
def admin_home():
    cfg = load_config()
    with state_lock:
        events = list(reversed(runtime_state["bridge_events"][-40:]))
    rendered_events = "\n".join(
        f"[{e['ts']}] {e['text']}" for e in events
    ) or "No events yet."
    return render_template_string(
        ADMIN_HTML,
        cfg=cfg,
        saved=request.args.get("saved") == "1",
        chat_id=BOOT_CHAT_ID,
        token_state="yes" if BOT_TOKEN else "no",
        events=rendered_events,
    )


@app.post("/admin/save")
def save_admin():
    cfg = load_config()
    cfg["require_whitelist"] = request.form.get("require_whitelist", "true") == "true"
    cfg["allowed_usernames"] = [
        x.strip().lstrip("@").lower()
        for x in request.form.get("allowed_usernames", "").split(",")
        if x.strip()
    ]
    cfg["allowed_user_ids"] = [
        int(x.strip())
        for x in request.form.get("allowed_user_ids", "").split(",")
        if x.strip().isdigit()
    ]
    verb = (request.form.get("verbosity", "normal") or "normal").strip().lower()
    cfg["verbosity"] = verb if verb in ("quiet", "normal", "verbose") else "normal"
    save_config(cfg)
    log_event("Admin updated bridge configuration.", "normal")
    return redirect(url_for("admin_home", saved="1"))


def boot_worker() -> None:
    t = threading.Thread(target=bridge_loop, daemon=True)
    t.start()


if __name__ == "__main__":
    ensure_data_dir()
    load_config()
    boot_worker()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
