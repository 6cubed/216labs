#!/usr/bin/env python3
"""Run once before gunicorn so cold deploys with an empty data volume get a usable feed."""
from app import bootstrap_seed_if_empty, get_db, init_db

if __name__ == "__main__":
    init_db()
    with get_db() as conn:
        bootstrap_seed_if_empty(conn, min_count=80)
