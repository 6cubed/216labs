#!/usr/bin/env python3
"""Fill empty internal-panel + Agitweet secrets in 216labs.db (idempotent).

Never prints secret values. Run on the droplet after sync-admin-db-manifests.py:

  python3 scripts/sync-admin-db-manifests.py /opt/216labs/216labs.db
  python3 scripts/bootstrap-internal-panel-env.py /opt/216labs/216labs.db
  python3 scripts/export-env-admin-from-db.py /opt/216labs/216labs.db > .env.admin
"""
from __future__ import annotations

import secrets
import sqlite3
import sys
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _is_empty(val: str | None) -> bool:
    return not (val or "").strip()


def _ensure_key(conn: sqlite3.Connection, key: str, generator) -> bool:
    row = conn.execute("SELECT value FROM env_vars WHERE key = ?", (key,)).fetchone()
    if not row:
        print(f"skip {key}: no env_vars row (run sync-admin-db-manifests.py)")
        return False
    if not _is_empty(row[0]):
        print(f"ok {key}: already set")
        return False
    val = generator()
    conn.execute(
        "UPDATE env_vars SET value = ?, updated_at = ? WHERE key = ?",
        (val, _now(), key),
    )
    print(f"set {key}: generated (value not logged)")
    return True


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "216labs.db"
    conn = sqlite3.connect(path)
    changed = 0
    # Cron ingest + session fallback for DiffTinder and other panels.
    if _ensure_key(conn, "CRON_RUNNER_SECRET", lambda: secrets.token_urlsafe(32)):
        changed += 1
    if _ensure_key(conn, "AGITWEET_API_TOKEN", lambda: secrets.token_urlsafe(32)):
        changed += 1
    if _ensure_key(conn, "ADMIN_PANEL_PASSWORD", lambda: secrets.token_urlsafe(18)):
        changed += 1
    conn.commit()
    conn.close()
    print(f"done: {changed} key(s) updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
