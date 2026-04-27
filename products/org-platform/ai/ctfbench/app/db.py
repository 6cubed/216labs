from __future__ import annotations

import os
import sqlite3
import time


def db_path() -> str:
    return os.environ.get("CTFBENCH_DB_PATH", "/app/data/ctfbench.db").strip() or "/app/data/ctfbench.db"


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(db_path(), check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL;")
    con.execute("PRAGMA synchronous=NORMAL;")
    return con


def init_db(con: sqlite3.Connection) -> None:
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS solve (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          challenge_id TEXT NOT NULL,
          solver_name TEXT NOT NULL,
          solver_contact TEXT,
          solver_fingerprint TEXT NOT NULL,
          solved_at_utc INTEGER NOT NULL
        );
        """
    )
    con.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS solve_unique_solver
        ON solve(challenge_id, solver_fingerprint);
        """
    )
    con.execute(
        """
        CREATE INDEX IF NOT EXISTS solve_by_challenge_time
        ON solve(challenge_id, solved_at_utc);
        """
    )
    con.execute(
        """
        CREATE INDEX IF NOT EXISTS solve_by_time
        ON solve(solved_at_utc);
        """
    )
    con.commit()


def now_utc_s() -> int:
    return int(time.time())

