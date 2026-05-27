from __future__ import annotations

import logging
import os
import re
import threading
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, redirect, render_template, request, url_for

from criteria import MARKETS
from database import get_db, init_db
from geo import count_listings_for_tracker, tracker_center
from scraper import sync_all_markets, sync_market

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

_SYNC_LOCK = threading.Lock()
_SYNC_RUNNING = False

_DB_READY = False


def ensure_db() -> None:
    global _DB_READY
    if not _DB_READY:
        init_db()
        _DB_READY = True


def market_dashboard(slug: str) -> dict:
    market = MARKETS[slug]
    with get_db() as conn:
        active_count = conn.execute(
            "SELECT COUNT(*) AS c FROM listings WHERE market_slug = ? AND active = 1",
            (slug,),
        ).fetchone()["c"]

        listings = conn.execute(
            """
            SELECT daft_id, title, url, distance_m, price_eur, beds, sqm, property_type,
                   first_seen_at, last_seen_at
            FROM listings
            WHERE market_slug = ? AND active = 1
            ORDER BY COALESCE(price_eur, 99999), distance_m
            """,
            (slug,),
        ).fetchall()

        history = conn.execute(
            """
            SELECT counted_at, active_count, new_count, removed_count
            FROM stock_snapshots
            WHERE market_slug = ?
            ORDER BY counted_at DESC
            LIMIT 60
            """,
            (slug,),
        ).fetchall()

        last_sync = conn.execute(
            """
            SELECT finished_at, status, listings_matched, error
            FROM sync_runs
            WHERE market_slug = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (slug,),
        ).fetchone()

    history = list(reversed(history))
    latest = history[-1] if history else None
    prev = history[-2] if len(history) > 1 else None

    return {
        "market": market,
        "active_count": active_count,
        "listings": listings,
        "history": history,
        "delta": (latest["active_count"] - prev["active_count"]) if latest and prev else 0,
        "last_new": latest["new_count"] if latest else 0,
        "last_removed": latest["removed_count"] if latest else 0,
        "last_sync": last_sync,
    }


@app.before_request
def _before() -> None:
    ensure_db()


@app.route("/healthz")
def healthz():
    return {"ok": True, "service": "rentstock"}


@app.route("/")
def index():
    markets = [market_dashboard(slug) for slug in MARKETS]
    with get_db() as conn:
        trackers = conn.execute(
            """
            SELECT id, slug, name, market_slug, radius_m, min_beds, max_price_eur, created_at
            FROM trackers
            ORDER BY id DESC
            LIMIT 50
            """
        ).fetchall()
    return render_template("index.html", markets=markets, trackers=trackers)


@app.route("/market/<slug>")
def market_page(slug: str):
    if slug not in MARKETS:
        return "Unknown market", 404
    data = market_dashboard(slug)
    return render_template("market.html", **data)


def _slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").strip().lower()).strip("-")
    return s or "tracker"


@app.route("/trackers", methods=["GET", "POST"])
def trackers_page():
    if request.method == "POST":
        name = (request.form.get("name") or "").strip()
        market_slug = (request.form.get("market_slug") or "").strip()
        radius_km_raw = (request.form.get("radius_km") or "").strip()
        center_lat_raw = (request.form.get("center_lat") or "").strip()
        center_lon_raw = (request.form.get("center_lon") or "").strip()
        min_beds_raw = (request.form.get("min_beds") or "").strip()
        max_price_raw = (request.form.get("max_price_eur") or "").strip()

        if not name or market_slug not in MARKETS:
            return redirect(url_for("trackers_page"))

        market = MARKETS[market_slug]
        min_beds = int(min_beds_raw) if min_beds_raw.isdigit() else None
        max_price = int(max_price_raw) if max_price_raw.isdigit() else None
        radius_m = None
        if radius_km_raw:
            try:
                km = float(radius_km_raw)
                # Clamp to a sane range.
                km = max(0.5, min(50.0, km))
                radius_m = int(km * 1000)
            except Exception:
                radius_m = None
        if radius_m is None:
            radius_m = int(market.radius_m)

        center_lat = center_lon = None
        if center_lat_raw and center_lon_raw:
            try:
                center_lat = float(center_lat_raw)
                center_lon = float(center_lon_raw)
            except ValueError:
                center_lat = center_lon = None

        base = _slugify(name)
        slug = base
        with get_db() as conn:
            i = 2
            while (
                conn.execute("SELECT 1 FROM trackers WHERE slug = ?", (slug,)).fetchone()
                is not None
            ):
                slug = f"{base}-{i}"
                i += 1
            conn.execute(
                """
                INSERT INTO trackers (
                    slug, name, market_slug, center_lat, center_lon,
                    radius_m, min_beds, max_price_eur, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                """,
                (slug, name, market_slug, center_lat, center_lon, radius_m, min_beds, max_price),
            )
        return redirect(url_for("tracker_page", slug=slug))

    with get_db() as conn:
        trackers = conn.execute(
            """
            SELECT id, slug, name, market_slug, center_lat, center_lon,
                   radius_m, min_beds, max_price_eur, created_at
            FROM trackers
            ORDER BY id DESC
            """
        ).fetchall()
    return render_template("trackers.html", trackers=trackers, markets=MARKETS)


def tracker_dashboard(tracker_slug: str) -> dict:
    with get_db() as conn:
        t = conn.execute(
            """
            SELECT id, slug, name, market_slug, center_lat, center_lon,
                   radius_m, min_beds, max_price_eur, created_at
            FROM trackers WHERE slug = ?
            """,
            (tracker_slug,),
        ).fetchone()
        if not t:
            return {"tracker": None}

        market_slug = t["market_slug"]
        market = MARKETS.get(market_slug)
        active_count = count_listings_for_tracker(conn, t, market)
        radius_m = int(t["radius_m"] or (market.radius_m if market else 0))
        clat, clon = tracker_center(t["center_lat"], t["center_lon"], market)

        history = conn.execute(
            """
            SELECT counted_at, active_count
            FROM tracker_snapshots
            WHERE tracker_id = ?
            ORDER BY counted_at DESC
            LIMIT 52
            """,
            (t["id"],),
        ).fetchall()
        history = list(reversed(history))

    return {
        "tracker": t,
        "market": market,
        "active_count": active_count,
        "history": history,
        "radius_m": radius_m,
        "center_lat": clat,
        "center_lon": clon,
    }


@app.route("/tracker/<slug>")
def tracker_page(slug: str):
    data = tracker_dashboard(slug)
    if not data.get("tracker"):
        return "Unknown tracker", 404
    return render_template("tracker.html", **data)


def snapshot_trackers() -> None:
    """Weekly snapshot of tracker stock (active count)."""
    ensure_db()
    with get_db() as conn:
        trackers = conn.execute(
            """
            SELECT id, market_slug, center_lat, center_lon,
                   radius_m, min_beds, max_price_eur
            FROM trackers
            """
        ).fetchall()
        for t in trackers:
            market = MARKETS.get(t["market_slug"])
            c = count_listings_for_tracker(conn, t, market)
            conn.execute(
                "INSERT INTO tracker_snapshots (tracker_id, counted_at, active_count) VALUES (?, datetime('now'), ?)",
                (t["id"], int(c)),
            )


@app.route("/api/markets")
def api_markets():
    out = []
    for slug in MARKETS:
        d = market_dashboard(slug)
        out.append(
            {
                "slug": slug,
                "name": d["market"].name,
                "criteria": d["market"].criteria_summary,
                "active_count": d["active_count"],
                "delta": d["delta"],
                "history": [
                    {
                        "at": h["counted_at"],
                        "count": h["active_count"],
                        "new": h["new_count"],
                        "removed": h["removed_count"],
                    }
                    for h in d["history"]
                ],
            }
        )
    return jsonify(out)


def _run_sync(slugs: list[str]) -> None:
    global _SYNC_RUNNING
    with _SYNC_LOCK:
        if _SYNC_RUNNING:
            return
        _SYNC_RUNNING = True
    try:
        for slug in slugs:
            sync_market(slug)
    finally:
        with _SYNC_LOCK:
            _SYNC_RUNNING = False


@app.route("/sync", methods=["POST"])
def sync_now():
    slug = request.form.get("market") or request.args.get("market")
    slugs = [slug] if slug in MARKETS else list(MARKETS.keys())
    if not _SYNC_RUNNING:
        threading.Thread(target=_run_sync, args=(slugs,), daemon=True).start()
    return redirect(request.referrer or url_for("index"))


def start_scheduler() -> BackgroundScheduler | None:
    if os.environ.get("RENTSTOCK_DISABLE_SCHEDULER") == "1":
        return None
    interval_hours = int(os.environ.get("RENTSTOCK_SYNC_INTERVAL_HOURS", "6"))
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(
        sync_all_markets,
        "interval",
        hours=interval_hours,
        id="rentstock_sync",
        replace_existing=True,
    )
    # Weekly tracker snapshots (Mon 00:05 UTC).
    scheduler.add_job(
        snapshot_trackers,
        "cron",
        day_of_week="mon",
        hour=0,
        minute=5,
        id="rentstock_weekly_snapshots",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduled Daft sync every %s hours", interval_hours)
    return scheduler


_scheduler = start_scheduler()
