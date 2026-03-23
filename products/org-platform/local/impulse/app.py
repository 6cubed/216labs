"""Impulse — nearby local offers sorted by distance from the user's location."""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import flask

app = flask.Flask(__name__)

DATA_PATH = Path(__file__).resolve().parent / "data" / "demo_offers.json"


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def load_offers() -> list[dict]:
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else []


@app.route("/")
def index():
    base = os.environ.get("IMPULSE_BASE_URL", "https://impulse.6cubed.app").rstrip("/")
    return flask.render_template("index.html", base_url=base)


@app.route("/api/offers")
def api_offers():
    try:
        lat = float(flask.request.args.get("lat", ""))
        lng = float(flask.request.args.get("lng", ""))
    except (TypeError, ValueError):
        return flask.jsonify({"error": "lat and lng query params required (numbers)"}), 400

    radius = flask.request.args.get("radius_km", "50")
    try:
        radius_km = float(radius)
    except ValueError:
        radius_km = 50.0
    radius_km = max(1.0, min(radius_km, 500.0))

    category = (flask.request.args.get("category") or "").strip().lower()

    offers = load_offers()
    enriched = []
    for o in offers:
        if category and o.get("category", "").lower() != category:
            continue
        d = haversine_km(lat, lng, float(o["lat"]), float(o["lng"]))
        if d > radius_km:
            continue
        row = dict(o)
        row["distance_km"] = round(d, 2)
        enriched.append(row)

    enriched.sort(key=lambda x: x["distance_km"])
    return flask.jsonify(
        {
            "count": len(enriched),
            "radius_km": radius_km,
            "center": {"lat": lat, "lng": lng},
            "offers": enriched,
        }
    )


@app.route("/health")
def health():
    return flask.jsonify({"ok": True, "offers_loaded": len(load_offers())})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
