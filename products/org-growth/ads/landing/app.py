# 216labs landing — 6cubed.app / www
import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone

from flask import Flask, render_template

app = Flask(__name__)


def _fetch_recent_deploys():
    base = os.environ.get("ADMIN_INTERNAL_URL", "http://admin:3000").rstrip("/")
    url = f"{base}/api/public/recent-deploys"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            items = data.get("items") or []
            if isinstance(items, list):
                return items
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, TypeError):
        pass
    return []


def _parse_deploy_time(s: str):
    if not s or not isinstance(s, str):
        return None
    s = s.strip()
    if "T" in s:
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            pass
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _relative_ago(dt: datetime) -> str:
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff_ms = (now - dt).total_seconds() * 1000
    if diff_ms <= 0:
        return "just now"
    minutes = int(diff_ms // 60000)
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes} min{'s' if minutes != 1 else ''} ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = hours // 24
    return f"{days} day{'s' if days != 1 else ''} ago"


def _enrich_items(raw):
    out = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        lid = row.get("id")
        name = row.get("name") or lid
        last = row.get("lastDeployedAt") or ""
        host = row.get("host") or ""
        url = row.get("url")
        parsed = _parse_deploy_time(last)
        out.append(
            {
                "id": lid,
                "name": name,
                "host": host,
                "url": url,
                "last_deployed_at": last,
                "relative": _relative_ago(parsed) if parsed else "",
                "absolute": parsed.strftime("%d %b %Y, %H:%M UTC") if parsed else last,
            }
        )
    return out


@app.route("/")
def index():
    items = _enrich_items(_fetch_recent_deploys())
    return render_template("index.html", recent_activity=items)
