#!/usr/bin/env python3
"""Ensure ADMIN_PASSWORD_HASH exists when ADMIN_PANEL_PASSWORD is set (Caddy basic auth).

Idempotent. Uses `docker run caddy:2-alpine caddy hash-password` when hash is missing.
Run on the droplet before export-env-admin-from-db.py (deploy.sh does this).

Usage: python3 scripts/ensure-admin-caddy-hash.py [path/to/216labs.db]
"""
from __future__ import annotations

import sqlite3
import subprocess
import sys
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _get(conn: sqlite3.Connection, key: str) -> str:
    row = conn.execute("SELECT value FROM env_vars WHERE key = ?", (key,)).fetchone()
    return (row[0] if row else "").strip()


def _upsert_hash(conn: sqlite3.Connection, admin_hash: str) -> None:
    user = _get(conn, "ADMIN_USER") or "admin"
    if not _get(conn, "ADMIN_USER"):
        conn.execute(
            "INSERT OR IGNORE INTO env_vars (key, value, description, is_secret, updated_at) "
            "VALUES ('ADMIN_USER', ?, 'HTTP basic auth user for admin.6cubed.app', 0, ?)",
            (user, _now()),
        )
    if _get(conn, "ADMIN_PASSWORD_HASH"):
        conn.execute(
            "UPDATE env_vars SET value = ?, updated_at = ? WHERE key = 'ADMIN_PASSWORD_HASH'",
            (admin_hash, _now()),
        )
    else:
        conn.execute(
            "INSERT INTO env_vars (key, value, description, is_secret, updated_at) "
            "VALUES ('ADMIN_PASSWORD_HASH', ?, 'Caddy bcrypt/PHC hash for admin basic auth.', 1, ?)",
            (admin_hash, _now()),
        )


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "216labs.db"
    conn = sqlite3.connect(path)
    panel = _get(conn, "ADMIN_PANEL_PASSWORD")
    existing = _get(conn, "ADMIN_PASSWORD_HASH")
    if not panel:
        print("skip: no ADMIN_PANEL_PASSWORD")
        return 0
    if existing:
        print("ok: ADMIN_PASSWORD_HASH already set")
        return 0
    try:
        proc = subprocess.run(
            [
                "docker",
                "run",
                "--rm",
                "caddy:2-alpine",
                "caddy",
                "hash-password",
                "--plaintext",
                panel,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        print(f"error: could not hash password ({e})", file=sys.stderr)
        return 1
    admin_hash = (proc.stdout or "").strip()
    if not admin_hash.startswith("$"):
        print("error: unexpected hash output", file=sys.stderr)
        return 1
    _upsert_hash(conn, admin_hash)
    conn.commit()
    conn.close()
    print("set: ADMIN_PASSWORD_HASH derived from ADMIN_PANEL_PASSWORD (value not logged)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
