from __future__ import annotations

import os
import sqlite3
from pathlib import Path

_DEFAULT_DATA = Path(__file__).resolve().parent / "data"
DATA_DIR = Path(os.environ.get("RENTSTOCK_DATA_DIR", str(_DEFAULT_DATA)))
DB_PATH = DATA_DIR / "rentstock.db"


def get_db() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_slug TEXT NOT NULL,
                daft_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                url TEXT NOT NULL DEFAULT '',
                lat REAL,
                lon REAL,
                distance_m INTEGER,
                price_eur INTEGER,
                beds INTEGER,
                sqm INTEGER,
                property_type TEXT NOT NULL DEFAULT '',
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                UNIQUE (market_slug, daft_id)
            );

            CREATE TABLE IF NOT EXISTS stock_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_slug TEXT NOT NULL,
                counted_at TEXT NOT NULL,
                active_count INTEGER NOT NULL,
                new_count INTEGER NOT NULL DEFAULT 0,
                removed_count INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS sync_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_slug TEXT NOT NULL,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                status TEXT NOT NULL DEFAULT 'running',
                pages_fetched INTEGER NOT NULL DEFAULT 0,
                listings_matched INTEGER NOT NULL DEFAULT 0,
                error TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_listings_market_active
                ON listings (market_slug, active);
            CREATE INDEX IF NOT EXISTS idx_snapshots_market_time
                ON stock_snapshots (market_slug, counted_at);

            CREATE TABLE IF NOT EXISTS trackers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                market_slug TEXT NOT NULL,
                center_lat REAL,
                center_lon REAL,
                radius_m INTEGER,
                min_beds INTEGER,
                max_price_eur INTEGER,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tracker_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tracker_id INTEGER NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
                counted_at TEXT NOT NULL,
                active_count INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tracker_snapshots_tracker_time
                ON tracker_snapshots (tracker_id, counted_at);
            """
        )

        # Migration: older DBs may not have radius_m yet.
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(trackers)").fetchall()]
        if "radius_m" not in cols:
            conn.execute("ALTER TABLE trackers ADD COLUMN radius_m INTEGER")
        if "center_lat" not in cols:
            conn.execute("ALTER TABLE trackers ADD COLUMN center_lat REAL")
        if "center_lon" not in cols:
            conn.execute("ALTER TABLE trackers ADD COLUMN center_lon REAL")
