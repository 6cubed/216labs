"""Mediate — two-party chat relayed only through an LLM mediator."""

from __future__ import annotations

import hmac
import os
import re
import sqlite3
import threading
import uuid
from collections import defaultdict
from pathlib import Path

import flask

app = flask.Flask(__name__)
app.secret_key = os.environ.get("MEDIATE_SECRET_KEY") or "dev-insecure-change-me"

DATA_DIR = os.environ.get("MEDIATE_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "mediate.db"

_room_locks: defaultdict[str, threading.Lock] = defaultdict(threading.Lock)


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                invite_token TEXT NOT NULL UNIQUE,
                host_key TEXT NOT NULL,
                goal TEXT,
                guest_joined INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL REFERENCES rooms(id),
                from_party TEXT NOT NULL CHECK (from_party IN ('a', 'b')),
                raw_text TEXT NOT NULL,
                mediated_text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, id);
            """
        )
        _ensure_mediator_mode_column(conn)


def _ensure_mediator_mode_column(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(rooms)").fetchall()}
    if "mediator_mode" not in cols:
        conn.execute(
            "ALTER TABLE rooms ADD COLUMN mediator_mode TEXT NOT NULL DEFAULT 'server'"
        )


@app.before_request
def _ensure_db():
    init_db()


def _base_url() -> str:
    base = (os.environ.get("MEDIATE_BASE_URL") or "").strip().rstrip("/")
    if base:
        return base
    return flask.request.url_root.rstrip("/")


def build_mediation_messages(
    *,
    goal: str | None,
    history_mediated: list[tuple[str, str]],
    sender: str,
    raw: str,
    recipient: str,
) -> tuple[str, str]:
    """Return (system_prompt, user_prompt). Kept in sync with client-side device mediation in room.html."""
    lines = []
    for party, text in history_mediated[-24:]:
        label = "Party A" if party == "a" else "Party B"
        lines.append(f"{label}: {text}")
    history_block = "\n".join(lines) if lines else "(no prior messages yet)"

    goal_block = (goal or "").strip()
    if not goal_block:
        goal_block = "No specific goal; keep the conversation constructive and fair."

    sender_label = "Party A" if sender == "a" else "Party B"
    recipient_label = "Party A" if recipient == "a" else "Party B"

    system = (
        "You are a neutral mediator between two people who never see each other's raw text. "
        "You rewrite each message so it can be relayed to the other party. "
        "Preserve intent, reduce unnecessary hostility, avoid manipulation, and stay concise. "
        "Output the single message text for the recipient only — no preamble, no quotes, no meta."
    )
    user = f"""Mediation goal / context:
{goal_block}

Mediated conversation so far:
{history_block}

{sender_label} writes (raw — do not repeat verbatim):
{raw}

Write ONLY the mediated message that {recipient_label} will receive."""
    return system, user


def _openai_mediates(
    *,
    goal: str | None,
    history_mediated: list[tuple[str, str]],
    sender: str,
    raw: str,
    recipient: str,
) -> str:
    api_key = (
        os.environ.get("MEDIATE_OPENAI_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or ""
    ).strip()
    if not api_key:
        return (
            "[Mediator unavailable: set MEDIATE_OPENAI_API_KEY on the server] "
            + raw[:500]
        )

    model = (os.environ.get("MEDIATE_MODEL") or "gpt-4o-mini").strip()
    system, user = build_mediation_messages(
        goal=goal,
        history_mediated=history_mediated,
        sender=sender,
        raw=raw,
        recipient=recipient,
    )

    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    r = client.chat.completions.create(
        model=model,
        temperature=0.4,
        max_tokens=800,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    text = (r.choices[0].message.content or "").strip()
    return text if text else raw[:2000]


def _room_row(conn: sqlite3.Connection, room_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM rooms WHERE id = ?", (room_id,)).fetchone()


def _resolve_party(room_id: str) -> str | None:
    if flask.session.get("mediate_room") != room_id:
        return None
    p = flask.session.get("mediate_party")
    return p if p in ("a", "b") else None


def _claim_host(room_id: str, host_key: str) -> bool:
    with get_db() as conn:
        row = _room_row(conn, room_id)
        if not row:
            return False
        if not secrets_compare(row["host_key"], host_key):
            return False
    flask.session["mediate_room"] = room_id
    flask.session["mediate_party"] = "a"
    return True


def secrets_compare(a: str, b: str) -> bool:
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a.encode(), b.encode())


@app.route("/")
def index():
    return flask.render_template("index.html")


@app.route("/create", methods=["POST"])
def create():
    goal = (flask.request.form.get("goal") or "").strip() or None
    mediator_mode = (flask.request.form.get("mediator_mode") or "server").strip().lower()
    if mediator_mode not in ("server", "device"):
        mediator_mode = "server"
    room_id = uuid.uuid4().hex
    invite_token = uuid.uuid4().hex + uuid.uuid4().hex
    host_key = uuid.uuid4().hex + uuid.uuid4().hex

    with get_db() as conn:
        conn.execute(
            "INSERT INTO rooms (id, invite_token, host_key, goal, mediator_mode) VALUES (?, ?, ?, ?, ?)",
            (room_id, invite_token, host_key, goal, mediator_mode),
        )

    flask.session["mediate_room"] = room_id
    flask.session["mediate_party"] = "a"

    base = _base_url()
    invite_url = f"{base}/invite/{invite_token}"
    return flask.render_template(
        "created.html",
        room_id=room_id,
        invite_url=invite_url,
        host_recovery_url=f"{base}/room/{room_id}?h={host_key}",
        goal=goal,
        mediator_mode=mediator_mode,
    )


@app.route("/invite/<token>")
def invite(token: str):
    token = (token or "").strip()
    if not re.fullmatch(r"[a-f0-9]+", token):
        return flask.abort(404)

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM rooms WHERE invite_token = ?", (token,)
        ).fetchone()

        if not row:
            return flask.render_template("invite_missing.html"), 404

        room_id = row["id"]

        if _resolve_party(room_id) == "a":
            return flask.redirect(flask.url_for("room", room_id=room_id))
        if _resolve_party(room_id) == "b":
            return flask.redirect(flask.url_for("room", room_id=room_id))

        if row["guest_joined"]:
            return flask.render_template("invite_closed.html"), 403

        conn.execute(
            "UPDATE rooms SET guest_joined = 1 WHERE id = ?",
            (room_id,),
        )

    flask.session["mediate_room"] = room_id
    flask.session["mediate_party"] = "b"
    return flask.redirect(flask.url_for("room", room_id=room_id))


@app.route("/room/<room_id>")
def room(room_id: str):
    if not re.fullmatch(r"[a-f0-9]{32}", room_id):
        return flask.abort(404)

    with get_db() as conn:
        row = _room_row(conn, room_id)
    if not row:
        return flask.render_template("invite_missing.html"), 404

    host_key = (flask.request.args.get("h") or "").strip()
    if host_key and _claim_host(room_id, host_key):
        pass

    party = _resolve_party(room_id)
    if not party:
        return flask.redirect(flask.url_for("index"))

    mediator_mode = (row["mediator_mode"] or "server").strip().lower()
    if mediator_mode not in ("server", "device"):
        mediator_mode = "server"

    return flask.render_template(
        "room.html", room_id=room_id, party=party, mediator_mode=mediator_mode
    )


@app.route("/api/room/<room_id>/state")
def api_state(room_id: str):
    if not re.fullmatch(r"[a-f0-9]{32}", room_id):
        return flask.jsonify({"error": "bad id"}), 400

    party = _resolve_party(room_id)
    if not party:
        return flask.jsonify({"error": "unauthorized"}), 401

    with get_db() as conn:
        row = _room_row(conn, room_id)
        if not row:
            return flask.jsonify({"error": "not found"}), 404

        rows = conn.execute(
            "SELECT id, from_party, raw_text, mediated_text, created_at FROM messages WHERE room_id = ? ORDER BY id ASC",
            (room_id,),
        ).fetchall()

    msgs = [
        {
            "id": r["id"],
            "from_party": r["from_party"],
            "raw_text": r["raw_text"],
            "mediated_text": r["mediated_text"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]

    mm = (row["mediator_mode"] or "server").strip().lower()
    if mm not in ("server", "device"):
        mm = "server"

    return flask.jsonify(
        {
            "you": party,
            "goal": row["goal"],
            "guest_joined": bool(row["guest_joined"]),
            "mediator_mode": mm,
            "messages": msgs,
        }
    )


@app.route("/api/room/<room_id>/send", methods=["POST"])
def api_send(room_id: str):
    if not re.fullmatch(r"[a-f0-9]{32}", room_id):
        return flask.jsonify({"error": "bad id"}), 400

    party = _resolve_party(room_id)
    if not party:
        return flask.jsonify({"error": "unauthorized"}), 401

    body = flask.request.get_json(silent=True) or {}
    raw = (body.get("text") or "").strip()
    if not raw:
        return flask.jsonify({"error": "empty text"}), 400
    if len(raw) > 8000:
        return flask.jsonify({"error": "too long"}), 400

    recipient = "b" if party == "a" else "a"

    lock = _room_locks[room_id]
    with lock:
        with get_db() as conn:
            row = _room_row(conn, room_id)
            if not row:
                return flask.jsonify({"error": "not found"}), 404

            mediator_mode = (row["mediator_mode"] or "server").strip().lower()
            if mediator_mode not in ("server", "device"):
                mediator_mode = "server"

            prev = conn.execute(
                "SELECT from_party, mediated_text FROM messages WHERE room_id = ? ORDER BY id ASC",
                (room_id,),
            ).fetchall()
            history = [(r["from_party"], r["mediated_text"]) for r in prev]

            if mediator_mode == "device":
                mediated = (body.get("mediated_text") or "").strip()
                if not mediated:
                    return (
                        flask.jsonify(
                            {
                                "error": "mediated_text required for on-device mediator rooms",
                            }
                        ),
                        400,
                    )
                if len(mediated) > 8000:
                    return flask.jsonify({"error": "mediated text too long"}), 400
            else:
                mediated = _openai_mediates(
                    goal=row["goal"],
                    history_mediated=history,
                    sender=party,
                    raw=raw,
                    recipient=recipient,
                )

            cur = conn.execute(
                "INSERT INTO messages (room_id, from_party, raw_text, mediated_text) VALUES (?, ?, ?, ?)",
                (room_id, party, raw, mediated),
            )
            msg_id = cur.lastrowid

    return flask.jsonify(
        {
            "ok": True,
            "id": msg_id,
            "mediated_text": mediated,
        }
    )


@app.route("/health")
def health():
    return flask.jsonify({"ok": True, "service": "mediate"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
