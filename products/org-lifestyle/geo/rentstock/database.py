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
            """
        )
