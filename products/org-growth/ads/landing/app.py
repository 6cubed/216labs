# 216labs landing — 6cubed.app / www
import json
import os
import urllib.error
import urllib.request

from flask import Flask, render_template

app = Flask(__name__)


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
