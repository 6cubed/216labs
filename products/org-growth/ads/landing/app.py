# 216labs landing — 6cubed.app / www
import os
import re
import traceback

from flask import Flask, render_template, request

from client_error_report import client_error_script, report_server_error
from labs_http import fetch_json, normalize_blog_items

app = Flask(__name__)

_GA_MEASUREMENT_ID_RE = re.compile(r"^G-[A-Z0-9]+$")


def _ga_measurement_id() -> str:
    raw = os.environ.get("GA_MEASUREMENT_ID", "").strip()
    return raw if _GA_MEASUREMENT_ID_RE.match(raw) else ""


@app.context_processor
def _inject_ga_context():
    return {"ga_measurement_id": _ga_measurement_id()}


@app.context_processor
def _inject_client_error_script():
    return {"client_error_script_html": client_error_script("landing")}


# deploy_enabled=1 is not "up". Listing the catalogue dumps visitors on activator.
# These hosts already return 200 without a warmup (spine + human-visited).
_LIVE_NOW_IDS = frozenset(
    {
        "anchor",
        "zurichrunclubs",
        "storybook",
        "kidgift",
        "1pageresearch",
        "maxlearn",
    }
)


def _fetch_live_apps():
    """Apps a stranger can open now — not the full deploy_enabled catalogue."""
    base = os.environ.get("ADMIN_INTERNAL_URL", "http://admin:3000").rstrip("/")
    url = f"{base}/api/public/live-apps"
    data = fetch_json(url, timeout=4, default=None)
    if not isinstance(data, dict):
        public = os.environ.get(
            "ADMIN_PUBLIC_LIVE_APPS_URL",
            "https://admin.6cubed.app/api/public/live-apps",
        ).strip()
        data = fetch_json(public, timeout=4, default=None)
    if not isinstance(data, dict):
        return []
    items = data.get("items") or []
    if not isinstance(items, list):
        return []
    return [
        i
        for i in items
        if isinstance(i, dict) and str(i.get("id") or "").lower() in _LIVE_NOW_IDS
    ]


def _fetch_blog_feed():
    """Latest posts from the blog service (same Docker network).

    Blog is often cold (Caddy → activator warmup). Public https://blog.6cubed.app/api/feed
    then returns HTML, not JSON, so there is no useful public fallback. Pin the hire-proof
    posts so 6cubed.app never looks like the lab has no writing.
    """
    url = os.environ.get("BLOG_FEED_URL", "http://blog:3000/api/feed").strip()
    data = fetch_json(url, timeout=2, default=None)
    items = normalize_blog_items(data, max_items=10) if data is not None else []
    return items if items else list(_FALLBACK_BLOG_POSTS)


# Shown when the blog container is stopped. Keep CARFAC first — it is the audio/ML proof URL.
_FALLBACK_BLOG_POSTS = [
    {
        "title": "What a cochlear model hears underwater (and what it does not)",
        "excerpt": "CARFAC SAI vs mel on Orcasound hydrophone audio. A sendable URL for audio/ML pilots.",
        "date": "2026-08-15",
        "url": "https://github.com/6cubed/216labs/tree/main/colabs/carfac-sai-underwater",
    },
    {
        "title": "CARFAC pilots — labelled-audio detection on your files",
        "excerpt": "€5–15k time-boxed pilots for hydrophone, drone, and bird audio. Always on GitHub.",
        "date": "2026-08-15",
        "url": "https://github.com/6cubed/216labs/tree/main/docs/carfac-pilots",
    },
    {
        "title": "Public CARFAC notebooks",
        "excerpt": "Open-in-Colab demos: vs-mel, drone SAI, underwater SAI.",
        "date": "2026-08-15",
        "url": "https://github.com/6cubed/216labs/tree/main/colabs",
    },
]


@app.route("/health")
def health():
    return ("ok", 200, {"Content-Type": "text/plain; charset=utf-8"})


@app.route("/")
def index():
    live_apps = _fetch_live_apps()
    blog_posts = _fetch_blog_feed()
    return render_template("index.html", live_apps=live_apps, blog_posts=blog_posts)


@app.route("/about")
def about():
    live_apps = _fetch_live_apps()
    return render_template("about.html", live_apps=live_apps)


@app.route("/careers")
def careers():
    return render_template("careers.html")


@app.errorhandler(500)
def internal_error(exc: Exception):
    report_server_error(
        "landing",
        str(exc),
        stack=traceback.format_exc(),
        url=request.url if request else "",
    )
    return "Internal Server Error", 500
