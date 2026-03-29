import json
import os
import random
import smtplib
import sqlite3
import urllib.parse
import urllib.request
from datetime import UTC, datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

import flask

app = flask.Flask(__name__)
app.secret_key = os.environ.get("TLDRTECH_SESSION_SECRET", "tldrtech-dev-secret")

DATA_DIR = os.environ.get("TLDRTECH_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "tldrtech.db"


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS subscribers (
                email TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )


FALLBACK_ITEMS = [
    {
        "title": "AI model releases are accelerating faster than enterprise adoption",
        "url": "https://openai.com/news/",
        "summary": "New launches are frequent, but orgs still struggle with governance, evals, and rollout speed.",
    },
    {
        "title": "Big Tech doubles down on on-device AI experiences",
        "url": "https://developer.apple.com/machine-learning/",
        "summary": "Privacy and latency gains are pushing more inference to phones and laptops.",
    },
    {
        "title": "GPU demand remains tight across training and inference workloads",
        "url": "https://www.nvidia.com/en-us/",
        "summary": "Infrastructure constraints are shaping startup roadmaps as much as product decisions.",
    },
    {
        "title": "Open-source models keep closing quality gaps in key tasks",
        "url": "https://huggingface.co/models",
        "summary": "Lower cost and customizability are widening viable paths beyond closed APIs.",
    },
    {
        "title": "Devtools race shifts from generation to reliability and review",
        "url": "https://github.blog/",
        "summary": "Teams now prioritize testing, guardrails, and integration over raw autocomplete wow-factor.",
    },
]


def _fetch_hn_top_stories_for_previous_day(max_items: int = 5) -> list[dict[str, str]]:
    now = datetime.now(UTC)
    start_prev = datetime(now.year, now.month, now.day, tzinfo=UTC) - timedelta(days=1)
    end_prev = datetime(now.year, now.month, now.day, tzinfo=UTC)

    params = {
        "tags": "story",
        "hitsPerPage": "50",
        "numericFilters": f"created_at_i>{int(start_prev.timestamp())},created_at_i<{int(end_prev.timestamp())}",
    }
    url = "https://hn.algolia.com/api/v1/search_by_date?" + urllib.parse.urlencode(params)

    try:
        with urllib.request.urlopen(url, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return FALLBACK_ITEMS[:max_items]

    hits = payload.get("hits") or []
    ranked = sorted(
        hits,
        key=lambda h: (
            int(h.get("points") or 0),
            int(h.get("num_comments") or 0),
        ),
        reverse=True,
    )

    items: list[dict[str, str]] = []
    seen_titles: set[str] = set()
    for hit in ranked:
        title = (hit.get("title") or "").strip()
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        link = (hit.get("url") or "").strip() or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
        points = int(hit.get("points") or 0)
        comments = int(hit.get("num_comments") or 0)
        items.append(
            {
                "title": title,
                "url": link,
                "summary": f"Community signal: {points} points and {comments} comments on Hacker News.",
            }
        )
        if len(items) >= max_items:
            break

    return items or FALLBACK_ITEMS[:max_items]


def _augment_items_with_openai(items: list[dict[str, str]]) -> list[dict[str, str]]:
    api_key = (
        os.environ.get("TLDRTECH_OPENAI_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or ""
    ).strip()
    if not api_key:
        return items
    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        titles = "\n".join([f"- {i['title']}" for i in items])
        prompt = (
            "You are writing a tech newsletter. For each headline below, output one concise "
            "sentence (max 20 words) explaining why it matters to builders/operators/investors. "
            "Return JSON object with key 'summaries' as array in same order.\n\n"
            f"Headlines:\n{titles}"
        )
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
            max_tokens=260,
        )
        content = (completion.choices[0].message.content or "").strip()
        parsed: Any = json.loads(content)
        summaries = parsed.get("summaries") if isinstance(parsed, dict) else None
        if isinstance(summaries, list):
            for idx, summary in enumerate(summaries[: len(items)]):
                if isinstance(summary, str) and summary.strip():
                    items[idx]["summary"] = summary.strip()
    except Exception:
        return items
    return items


def build_email_html(items: list[dict[str, str]], date_label: str) -> str:
    rows = []
    for item in items:
        rows.append(
            f"""
            <tr>
              <td style="padding:0 0 18px 0;">
                <a href="{flask.escape(item['url'])}" style="font-size:18px;line-height:1.4;font-weight:700;color:#111827;text-decoration:none;">{flask.escape(item['title'])}</a>
                <p style="margin:7px 0 0;font-size:14px;line-height:1.6;color:#4b5563;">{flask.escape(item['summary'])}</p>
              </td>
            </tr>
            """
        )

    rendered_rows = "".join(rows)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TLDRTech Daily</title>
</head>
<body style="margin:0;padding:0;background:#eef2ff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:30px 18px;">
    <div style="background:#0f172a;color:#fff;border-radius:16px;padding:22px 24px;margin-bottom:14px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#93c5fd;">TLDRTech Daily</p>
      <h1 style="margin:0;font-size:24px;line-height:1.2;">Yesterday in tech, in five bullets.</h1>
      <p style="margin:8px 0 0;font-size:13px;line-height:1.6;color:#cbd5e1;">{flask.escape(date_label)}</p>
    </div>
    <div style="background:#ffffff;border:1px solid #dbeafe;border-radius:16px;padding:22px 22px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rendered_rows}</table>
    </div>
    <p style="text-align:center;margin:14px 0 0;color:#64748b;font-size:12px;">
      TLDRTech · <a href="https://tldrtech.6cubed.app" style="color:#2563eb;">tldrtech.6cubed.app</a>
    </p>
  </div>
</body>
</html>"""


def send_via_smtp(
    smtp_host: str,
    smtp_port: int,
    smtp_username: str,
    smtp_password: str,
    smtp_use_tls: bool,
    from_email: str,
    to_email: str,
    subject: str,
    html: str,
) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
        if smtp_use_tls:
            server.starttls()
        if smtp_username:
            server.login(smtp_username, smtp_password)
        server.sendmail(from_email, [to_email], msg.as_string())


@app.route("/")
def index() -> str:
    return flask.render_template("index.html")


@app.route("/subscribe", methods=["POST"])
def subscribe() -> flask.Response:
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
        flask.flash("Subscribed. Your first TLDRTech email arrives tomorrow.", "success")
    except Exception:
        flask.flash("Could not save your signup right now. Try again in a minute.", "error")
    return flask.redirect(flask.url_for("index"))


@app.route("/api/send-daily", methods=["POST"])
def send_daily() -> tuple[flask.Response, int] | flask.Response:
    secret = os.environ.get("TLDRTECH_CRON_SECRET", "").strip()
    if secret:
        auth = flask.request.headers.get("Authorization") or ""
        if auth != f"Bearer {secret}":
            return flask.jsonify({"error": "Unauthorized"}), 401

    smtp_host = os.environ.get("TLDRTECH_SMTP_HOST", "").strip()
    smtp_port_raw = os.environ.get("TLDRTECH_SMTP_PORT", "587").strip()
    smtp_username = os.environ.get("TLDRTECH_SMTP_USERNAME", "").strip()
    smtp_password = os.environ.get("TLDRTECH_SMTP_PASSWORD", "").strip()
    smtp_use_tls = os.environ.get("TLDRTECH_SMTP_USE_TLS", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    if not smtp_host:
        return flask.jsonify({"error": "TLDRTECH_SMTP_HOST not set"}), 500
    try:
        smtp_port = int(smtp_port_raw)
    except ValueError:
        return flask.jsonify({"error": "TLDRTECH_SMTP_PORT must be an integer"}), 500
    if smtp_username and not smtp_password:
        return flask.jsonify({"error": "TLDRTECH_SMTP_PASSWORD not set"}), 500

    from_email = os.environ.get(
        "TLDRTECH_FROM_EMAIL", "TLDRTech <daily@tldrtech.6cubed.app>"
    ).strip()
    item_count = random.randint(3, 5)
    items = _fetch_hn_top_stories_for_previous_day(max_items=item_count)
    items = _augment_items_with_openai(items)
    date_label = (datetime.now(UTC) - timedelta(days=1)).strftime("%A, %B %d")

    with get_db() as conn:
        rows = conn.execute("SELECT email FROM subscribers").fetchall()
    recipients = [r["email"] for r in rows]

    if not recipients:
        return flask.jsonify({"sent": 0, "message": "No subscribers"})

    subject = f"TLDRTech: {len(items)} stories that mattered ({date_label})"
    html = build_email_html(items, date_label)

    results: list[dict[str, Any]] = []
    for recipient in recipients:
        try:
            send_via_smtp(
                smtp_host=smtp_host,
                smtp_port=smtp_port,
                smtp_username=smtp_username,
                smtp_password=smtp_password,
                smtp_use_tls=smtp_use_tls,
                from_email=from_email,
                to_email=recipient,
                subject=subject,
                html=html,
            )
            results.append({"email": recipient, "success": True})
        except Exception as exc:
            results.append({"email": recipient, "success": False, "error": str(exc)})

    sent = sum(1 for r in results if r["success"])
    return flask.jsonify({"sent": sent, "total": len(recipients), "results": results})


@app.before_request
def ensure_db() -> None:
    init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
