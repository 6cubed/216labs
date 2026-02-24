import sqlite3
import os
from contextlib import contextmanager

DATABASE_PATH = os.environ.get("BIGLEROYS_DATABASE_PATH", "/app/data/bigleroys.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    nickname TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gameweeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER UNIQUE NOT NULL,
    lock_time DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fixtures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gameweek_id INTEGER NOT NULL REFERENCES gameweeks(id),
    pl_id TEXT UNIQUE,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    kickoff DATETIME NOT NULL,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'U',
    result TEXT,
    points_calculated INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
    prediction TEXT NOT NULL CHECK(prediction IN ('H', 'A', 'D')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, fixture_id)
);

CREATE TABLE IF NOT EXISTS point_awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id),
    points REAL NOT NULL,
    awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, fixture_id)
);

CREATE INDEX IF NOT EXISTS idx_fixtures_gameweek ON fixtures(gameweek_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_fixture ON predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_point_awards_user ON point_awards(user_id);
"""


def get_db():
    db = sqlite3.connect(DATABASE_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    return db


@contextmanager
def db_connection():
    db = get_db()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    db = get_db()
    db.executescript(SCHEMA)
    db.commit()
    db.close()


def calculate_points_for_fixture(fixture_id: int):
    """Award points after a fixture result is known. Uses rarity-based scoring."""
    with db_connection() as db:
        fixture = db.execute(
            "SELECT * FROM fixtures WHERE id = ? AND result IS NOT NULL AND points_calculated = 0",
            (fixture_id,),
        ).fetchone()
        if not fixture:
            return

        result = fixture["result"]

        predictions = db.execute(
            "SELECT user_id, prediction FROM predictions WHERE fixture_id = ?",
            (fixture_id,),
        ).fetchall()

        total_predictors = len(predictions)
        correct = [p["user_id"] for p in predictions if p["prediction"] == result]
        k = len(correct)

        if k == 0:
            db.execute(
                "UPDATE fixtures SET points_calculated = 1 WHERE id = ?", (fixture_id,)
            )
            return

        # Rarity-based: 10/K points each for correct predictors.
        # When fewer than 3 total predictors, cap reward at 10/3 = 3.333...
        # so a lone wolf doesn't farm 10 pts with zero competition.
        effective_k = k if total_predictors >= 3 else 3
        points_each = 10.0 / effective_k

        for user_id in correct:
            db.execute(
                """INSERT OR REPLACE INTO point_awards (user_id, fixture_id, points)
                   VALUES (?, ?, ?)""",
                (user_id, fixture_id, points_each),
            )

        db.execute(
            "UPDATE fixtures SET points_calculated = 1 WHERE id = ?", (fixture_id,)
        )
