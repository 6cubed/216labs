# 216labs landing — 6cubed.app / www
import json
import os
import re
import urllib.error
import urllib.request

from flask import Flask, render_template

app = Flask(__name__)

_GA_MEASUREMENT_ID_RE = re.compile(r"^G-[A-Z0-9]+$")


def _ga_measurement_id() -> str:
    raw = os.environ.get("GA_MEASUREMENT_ID", "").strip()
    return raw if _GA_MEASUREMENT_ID_RE.match(raw) else ""


@app.context_processor
def _inject_ga_context():
    return {"ga_measurement_id": _ga_measurement_id()}


def _fetch_live_apps():
    base = os.environ.get("ADMIN_INTERNAL_URL", "http://admin:3000").rstrip("/")
    url = f"{base}/api/public/live-apps"
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


def _fetch_blog_feed():
    """Latest posts from the blog service (same Docker network) or public URL fallback."""
    url = os.environ.get("BLOG_FEED_URL", "http://blog:3000/api/feed").strip()
    if not url:
        return []
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode())
            items = data.get("items") or []
            if not isinstance(items, list):
                return []
            out = []
            for it in items[:10]:
                if not isinstance(it, dict):
                    continue
                t = (it.get("title") or "").strip()
                u = (it.get("url") or "").strip()
                if not t or not u:
                    continue
                out.append(
                    {
                        "title": t,
                        "excerpt": (it.get("excerpt") or "").strip(),
                        "date": (it.get("date") or "").strip(),
                        "url": u,
                    }
                )
            return out
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, TypeError):
        pass
    return []


@app.route("/health")
def health():
    return ("ok", 200, {"Content-Type": "text/plain; charset=utf-8"})


@app.route("/")
def index():
    live_apps = _fetch_live_apps()
    blog_posts = _fetch_blog_feed()
    return render_template("index.html", live_apps=live_apps, blog_posts=blog_posts)
