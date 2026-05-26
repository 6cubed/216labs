import os
import re
import sqlite3
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

from client_error_report import client_error_script, report_server_error

app = Flask(__name__)

APP_ID = "agitweet"

_GA_MEASUREMENT_ID_RE = re.compile(r"^G-[A-Z0-9]+$")


def _ga_snippet() -> str:
    raw = os.environ.get("GA_MEASUREMENT_ID", "").strip()
    if not raw or not _GA_MEASUREMENT_ID_RE.match(raw):
        return ""
    return (
        f'<script async src="https://www.googletagmanager.com/gtag/js?id={raw}"></script>'
        "<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}"
        f"gtag('js',new Date());gtag('config','{raw}');</script>"
    )


def _db_path() -> Path:
    raw = os.environ.get("AGITWEET_DB_PATH", "").strip()
    if raw:
        return Path(raw)
    return Path("/app/data/agitweet.db")


def _connect() -> sqlite3.Connection:
    p = _db_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(p))
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS posts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at_utc INTEGER NOT NULL,
              text TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at_utc DESC)")


_init_db()


def _human_ts(ts: int) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(ts))


def _bearer_token(req) -> str | None:
    h = (req.headers.get("Authorization") or "").strip()
    if not h:
        return None
    if h.lower().startswith("bearer "):
        return h.split(None, 1)[1].strip()
    return None


def _require_write_auth() -> bool:
    want = os.environ.get("AGITWEET_API_TOKEN", "").strip()
    if not want:
        return False
    got = _bearer_token(request)
    return bool(got and got == want)


@dataclass(frozen=True)
class Post:
    id: int
    created_at_utc: int
    text: str

    @property
    def created_at_human(self) -> str:
        return _human_ts(self.created_at_utc)


def _fetch_posts(limit: int = 60) -> list[Post]:
    lim = max(1, min(200, int(limit)))
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, created_at_utc, text FROM posts ORDER BY created_at_utc DESC, id DESC LIMIT ?",
            (lim,),
        ).fetchall()
    return [Post(int(r["id"]), int(r["created_at_utc"]), str(r["text"])) for r in rows]


def _insert_post(text: str) -> int:
    now = int(time.time())
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO posts (created_at_utc, text) VALUES (?, ?)",
            (now, text),
        )
        conn.commit()
        return int(cur.lastrowid)


@app.get("/")
def home():
    posts = _fetch_posts(limit=int(request.args.get("limit", "60") or "60"))
    return render_template(
        "index.html",
        posts=posts,
        count=len(posts),
        ga_snippet=_ga_snippet(),
        client_err_script=client_error_script(APP_ID),
    )


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/api/posts")
def api_list_posts():
    posts = _fetch_posts(limit=int(request.args.get("limit", "60") or "60"))
    return jsonify(
        {
            "posts": [
                {"id": p.id, "created_at_utc": p.created_at_utc, "created_at": p.created_at_human, "text": p.text}
                for p in posts
            ]
        }
    )


@app.post("/api/posts")
def api_create_post():
    if not _require_write_auth():
        return jsonify({"error": "unauthorized"}), 401

    payload: dict[str, Any] = request.get_json(force=True, silent=True) or {}
    text = str(payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "text_required"}), 400
    if len(text) > 1000:
        return jsonify({"error": "text_too_long", "max_len": 1000}), 400

    pid = _insert_post(text)
    return jsonify({"ok": True, "id": pid}), 201


@app.errorhandler(500)
def internal_error(exc: Exception):
    report_server_error(
        APP_ID,
        str(exc),
        stack=traceback.format_exc(),
        url=request.url if request else "",
    )
    return "Internal Server Error", 500

