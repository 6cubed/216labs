import os
import sqlite3
import time
import traceback
from dataclasses import dataclass
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, url_for

from admin_session import (
    COOKIE_NAME,
    auth_configured,
    clear_session_cookie,
    issue_session_cookie,
    session_valid,
    verify_password,
)
from agitweet_post import agitweet_publish_configured, publish_approved_idea
from client_error_report import client_error_script, report_server_error

APP_ID = "difftinder"

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("ADMIN_PANEL_SESSION_SECRET") or os.environ.get(
    "CRON_RUNNER_SECRET", "dev-only-change-me"
)


def _db_path() -> Path:
    raw = os.environ.get("DIFFTINDER_DB_PATH", "").strip()
    if raw:
        return Path(raw)
    return Path("/app/data/difftinder.db")


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
            CREATE TABLE IF NOT EXISTS ideas (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              day_utc TEXT NOT NULL UNIQUE,
              title TEXT,
              body TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              source TEXT NOT NULL DEFAULT 'cron',
              created_at_utc INTEGER NOT NULL,
              voted_at_utc INTEGER
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status, created_at_utc DESC)"
        )


_init_db()


@dataclass(frozen=True)
class Idea:
    id: int
    day_utc: str
    title: str | None
    body: str
    status: str

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "Idea":
        return cls(
            int(row["id"]),
            str(row["day_utc"]),
            row["title"],
            str(row["body"]),
            str(row["status"]),
        )


def _today_utc() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


def _counts() -> dict[str, int]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) AS n FROM ideas GROUP BY status"
        ).fetchall()
    out = {"pending": 0, "yes": 0, "no": 0}
    for r in rows:
        st = str(r["status"])
        if st in out:
            out[st] = int(r["n"])
    return out


def _next_pending() -> Idea | None:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT id, day_utc, title, body, status FROM ideas
            WHERE status = 'pending'
            ORDER BY created_at_utc ASC, id ASC
            LIMIT 1
            """
        ).fetchone()
    return Idea.from_row(row) if row else None


def _ingest_secret() -> str:
    return (
        os.environ.get("DIFFTINDER_INGEST_SECRET", "").strip()
        or os.environ.get("CRON_RUNNER_SECRET", "").strip()
    )


def _require_session(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not auth_configured():
            return (
                render_template(
                    "login.html",
                    error="Set ADMIN_PANEL_PASSWORD and ADMIN_PANEL_SESSION_SECRET (or CRON_RUNNER_SECRET) in admin Env.",
                ),
                503,
            )
        if not session_valid(request.cookies.get(COOKIE_NAME)):
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapped


def _require_ingest(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        secret = _ingest_secret()
        if not secret:
            return jsonify({"error": "ingest_not_configured"}), 503
        auth = request.headers.get("Authorization", "")
        token = ""
        if auth.lower().startswith("bearer "):
            token = auth.split(None, 1)[1].strip()
        if token != secret:
            return jsonify({"error": "unauthorized"}), 401
        return view(*args, **kwargs)

    return wrapped


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if session_valid(request.cookies.get(COOKIE_NAME)):
            return redirect(url_for("deck"))
        if not auth_configured():
            return render_template(
                "login.html",
                error="ADMIN_PANEL_PASSWORD is not configured.",
            )
        return render_template("login.html", error=None)

    if not verify_password((request.form.get("password") or "").strip()):
        return render_template("login.html", error="Invalid password."), 401
    dest = request.args.get("next") or request.form.get("next") or url_for("deck")
    resp = redirect(dest)
    issue_session_cookie(resp, secure=request.is_secure)
    return resp


@app.post("/logout")
@_require_session
def logout():
    resp = redirect(url_for("login"))
    clear_session_cookie(resp)
    return resp


@app.get("/")
@_require_session
def deck():
    idea = _next_pending()
    return render_template(
        "deck.html",
        idea=idea,
        counts=_counts(),
        client_err_script=client_error_script(APP_ID),
    )


@app.get("/history")
@_require_session
def history():
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT day_utc, title, body, status FROM ideas
            ORDER BY created_at_utc DESC
            LIMIT 80
            """
        ).fetchall()
    return render_template("history.html", rows=[dict(r) for r in rows])


@app.post("/api/vote")
@_require_session
def api_vote():
    payload = request.get_json(force=True, silent=True) or {}
    idea_id = int(payload.get("id") or 0)
    vote = str(payload.get("vote") or "").strip().lower()
    if vote not in ("yes", "no"):
        return jsonify({"error": "invalid_vote"}), 400
    now = int(time.time())
    with _connect() as conn:
        cur = conn.execute(
            """
            UPDATE ideas SET status = ?, voted_at_utc = ?
            WHERE id = ? AND status = 'pending'
            """,
            (vote, now, idea_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "not_found_or_already_voted"}), 404
        row = None
        if vote == "yes":
            row = conn.execute(
                "SELECT day_utc, title, body FROM ideas WHERE id = ?",
                (idea_id,),
            ).fetchone()
        conn.commit()

    out: dict = {"ok": True, "status": vote}
    if vote == "yes" and row:
        if agitweet_publish_configured():
            posted, detail = publish_approved_idea(
                day_utc=str(row["day_utc"]),
                title=row["title"],
                body=str(row["body"]),
            )
            out["agitweet"] = {"posted": posted, "detail": detail}
        else:
            out["agitweet"] = {"posted": False, "detail": "not_configured"}
    return jsonify(out)


@app.get("/api/internal/today")
@_require_ingest
def api_internal_today():
    day = _today_utc()
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, day_utc, title, body, status FROM ideas WHERE day_utc = ?",
            (day,),
        ).fetchone()
    if not row:
        return jsonify({"exists": False, "day_utc": day})
    return jsonify({"exists": True, "idea": dict(row)})


@app.post("/api/internal/daily-idea")
@_require_ingest
def api_internal_daily_idea():
    payload = request.get_json(force=True, silent=True) or {}
    day = str(payload.get("day_utc") or _today_utc()).strip()
    title = str(payload.get("title") or "").strip() or None
    body = str(payload.get("body") or "").strip()
    if not body:
        return jsonify({"error": "body_required"}), 400
    if len(body) > 2000:
        return jsonify({"error": "body_too_long"}), 400
    now = int(time.time())
    with _connect() as conn:
        try:
            conn.execute(
                """
                INSERT INTO ideas (day_utc, title, body, status, source, created_at_utc)
                VALUES (?, ?, ?, 'pending', ?, ?)
                """,
                (day, title, body, str(payload.get("source") or "cron"), now),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            return jsonify({"ok": False, "skipped": True, "reason": "already_exists", "day_utc": day})
    return jsonify({"ok": True, "day_utc": day}), 201


@app.errorhandler(500)
def internal_error(exc: Exception):
    report_server_error(
        APP_ID,
        str(exc),
        stack=traceback.format_exc(),
        url=request.url if request else "",
    )
    return "Internal Server Error", 500
