from __future__ import annotations

import logging
import os
import threading
from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, redirect, render_template, request, url_for

from criteria import MARKETS
from database import get_db, init_db
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
    return render_template("index.html", markets=markets)


@app.route("/market/<slug>")
def market_page(slug: str):
    if slug not in MARKETS:
        return "Unknown market", 404
    data = market_dashboard(slug)
    return render_template("market.html", **data)


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
    scheduler.start()
    logger.info("Scheduled Daft sync every %s hours", interval_hours)
    return scheduler


_scheduler = start_scheduler()
