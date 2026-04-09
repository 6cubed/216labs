#!/usr/bin/env python3
"""
Emit KEY=value lines for docker compose --env-file .env.admin from 216labs.db.

Uses stdlib sqlite3 only (no Node). Escaping matches
scripts/write-env-admin-from-db.js: each literal $ in a value becomes $$.

Usage:
  python3 scripts/export-env-admin-from-db.py [path/to/216labs.db]
Default path: 216labs.db in the current working directory.
"""
from __future__ import annotations

import sqlite3
import sys


def escape_compose_env_value(v: str) -> str:
    return str(v).replace("$", "$$")


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "216labs.db"
    conn = sqlite3.connect(path)
    try:
        rows = conn.execute(
            "SELECT key, value FROM env_vars WHERE value IS NOT NULL AND length(trim(value)) > 0"
        ).fetchall()
    finally:
        conn.close()
    for key, value in rows:
        sys.stdout.write(key + "=" + escape_compose_env_value(value) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
