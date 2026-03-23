# Explore — nearby instant experiences (Ireland seed data)
from __future__ import annotations

import math
import os
import sqlite3
from pathlib import Path

import flask

from seed_data import SEED

app = flask.Flask(__name__)

_DEFAULT_DATA = Path(__file__).resolve().parent / "data"
DATA_DIR = os.environ.get("EXPLORE_DATA_DIR", str(_DEFAULT_DATA))
DB_PATH = Path(DATA_DIR) / "explore.db"

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def get_db() -> sqlite3.Connection:
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS places (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                category TEXT NOT NULL DEFAULT 'other',
                locality TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS experiences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
                headline TEXT NOT NULL,
                body TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'other',
                disclaimer TEXT NOT NULL DEFAULT 'Illustrative — verify hours, prices, and offers locally.'
            );
            CREATE INDEX IF NOT EXISTS idx_places_lat_lon ON places(lat, lon);
            """
        )
        n = conn.execute("SELECT COUNT(*) AS c FROM places").fetchone()["c"]
        if n == 0:
            for row in SEED:
                cur = conn.execute(
                    """
                    INSERT INTO places (name, lat, lon, category, locality, address)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["name"],
                        row["lat"],
                        row["lon"],
                        row["category"],
                        row["locality"],
                        row["address"],
                    ),
                )
                pid = cur.lastrowid
                conn.execute(
                    """
                    INSERT INTO experiences (place_id, headline, body, kind)
                    VALUES (?, ?, ?, ?)
                    """,
                    (pid, row["headline"], row["body"], row["kind"]),
                )


@app.route("/healthz")
def healthz():
    return {"ok": True, "service": "explore"}


@app.route("/api/nearby")
def api_nearby():
    try:
        lat = float(flask.request.args.get("lat", ""))
        lon = float(flask.request.args.get("lon", ""))
    except (TypeError, ValueError):
        return {"error": "lat and lon required as numbers"}, 400

    radius = flask.request.args.get("radius_m", "3000")
    try:
        radius_m = max(100, min(50_000, float(radius)))
    except ValueError:
        radius_m = 3000.0

    limit = flask.request.args.get("limit", "40")
    try:
        lim = max(1, min(100, int(limit)))
    except ValueError:
        lim = 40

    init_db()
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT p.id, p.name, p.lat, p.lon, p.category, p.locality, p.address,
                   e.headline, e.body, e.kind, e.disclaimer
            FROM places p
            JOIN experiences e ON e.place_id = p.id
            """
        ).fetchall()

    out = []
    for r in rows:
        d = haversine_m(lat, lon, r["lat"], r["lon"])
        if d <= radius_m:
            out.append(
                {
                    "place_id": r["id"],
                    "name": r["name"],
                    "lat": r["lat"],
                    "lon": r["lon"],
                    "category": r["category"],
                    "locality": r["locality"],
                    "address": r["address"],
                    "distance_m": round(d),
                    "experience": {
                        "headline": r["headline"],
                        "body": r["body"],
                        "kind": r["kind"],
                        "disclaimer": r["disclaimer"],
                    },
                }
            )

    out.sort(key=lambda x: x["distance_m"])
    return {"lat": lat, "lon": lon, "radius_m": radius_m, "results": out[:lim]}


@app.route("/")
def index():
    return flask.render_template("index.html")


init_db()
