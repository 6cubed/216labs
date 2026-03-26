# EmailGPT — one-page opt-in, one email per day nudging you along
import os
import random
import sqlite3
from datetime import datetime
from pathlib import Path

import flask
import resend

app = flask.Flask(__name__)

DATA_DIR = os.environ.get("EMAILGPT_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "emailgpt.db"


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS subscribers (
                email TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)


# Static nudge pool when no OpenAI key
NUDGE_POOL = [
    "What's one small thing you could do today that your future self would thank you for?",
    "Pause. Breathe. What are you avoiding that would take less than five minutes?",
    "Today's nudge: one sentence you'd be proud to have written by tonight. Go write it.",
    "What would you tell a friend in your situation? Say it to yourself.",
    "One tiny yes today. Not the whole project — just the next 10 minutes.",
    "What's already working? Name three things before you fix anything.",
    "Your nudge: move your body for 60 seconds. Then decide what's next.",
    "What's the one thing that, if you did it, would make everything else easier?",
    "Today: one act of kindness for yourself. What would it be?",
    "What are you pretending not to know? Write one line.",
    "Nudge: close your eyes and name one thing you're grateful for right now.",
    "One boundary you could set today. Just one. What is it?",
    "What would 'enough' look like for today? Define it in one sentence.",
    "Your nudge: tell one person something you appreciate about them.",
    "What's the smallest step toward the thing you keep putting off? Do that.",
]


def get_nudge() -> str:
    api_key = os.environ.get("EMAILGPT_OPENAI_API_KEY", "").strip()
    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            r = client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=120,
                temperature=0.9,
                messages=[{
                    "role": "user",
                    "content": "Write a single short, kind daily nudge or reflection (one or two sentences). No greeting, no sign-off — just the nudge. Be concise and warm."
                }]
            )
            text = (r.choices[0].message.content or "").strip()
            if text:
                return text
        except Exception:
            pass
    return random.choice(NUDGE_POOL)


def build_email_html(nudge: str, date: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your daily nudge</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e9e5ff;">
      <p style="font-size:11px;color:#888;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 12px;">{date}</p>
      <p style="font-size:18px;line-height:1.6;color:#1a1a2e;margin:0;">{nudge}</p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#888;">
      — EmailGPT · <a href="https://emailgpt.6cubed.app" style="color:#7c3aed;">emailgpt.6cubed.app</a>
    </p>
  </div>
</body>
</html>"""


@app.route("/")
def index():
    return flask.render_template("index.html")


@app.route("/subscribe", methods=["POST"])
def subscribe():
    email = (flask.request.form.get("email") or "").strip().lower()
    if not email or "@" not in email:
        flask.flash("Please enter a valid email address.", "error")
        return flask.redirect(flask.url_for("index"))
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO subscribers (email) VALUES (?)",
                (email,),
            )
        flask.flash("You're in. Check your inbox tomorrow for your first nudge.", "success")
    except Exception:
        flask.flash("Something went wrong. Try again later.", "error")
    return flask.redirect(flask.url_for("index"))


@app.route("/api/send-daily", methods=["POST"])
def send_daily():
    secret = os.environ.get("EMAILGPT_CRON_SECRET", "").strip()
    if secret:
        auth = flask.request.headers.get("Authorization") or ""
        if auth != f"Bearer {secret}":
            return flask.jsonify({"error": "Unauthorized"}), 401

    api_key = os.environ.get("EMAILGPT_RESEND_API_KEY", "").strip()
    if not api_key:
        return flask.jsonify({"error": "EMAILGPT_RESEND_API_KEY not set"}), 500

    from_email = os.environ.get("EMAILGPT_FROM_EMAIL", "EmailGPT <nudge@emailgpt.6cubed.app>")
    resend.api_key = api_key
    date_str = datetime.utcnow().strftime("%A, %B %d")
    nudge = get_nudge()
    html = build_email_html(nudge, date_str)

    with get_db() as conn:
        rows = conn.execute("SELECT email FROM subscribers").fetchall()
    subscribers = [r["email"] for r in rows]

    if not subscribers:
        return flask.jsonify({"sent": 0, "message": "No subscribers"})

    results = []
    for email in subscribers:
        try:
            resend.Emails.send(
                {
                    "from": from_email,
                    "to": [email],
                    "subject": f"Your nudge for {date_str}",
                    "html": html,
                }
            )
            results.append({"email": email, "success": True})
        except Exception as e:
            results.append({"email": email, "success": False, "error": str(e)})

    sent = sum(1 for r in results if r["success"])
    return flask.jsonify({"sent": sent, "total": len(subscribers), "results": results})


@app.before_request
def ensure_db():
    init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
