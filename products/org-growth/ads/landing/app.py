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


@app.route("/")
def index():
    live_apps = _fetch_live_apps()
    return render_template("index.html", live_apps=live_apps)
