#!/usr/bin/env bash
# Recent lead_event rows from 216labs.db (landing hire form, etc.).
# Usage: ./scripts/query_leads.sh [limit]
set -euo pipefail

LIMIT="${1:-20}"
DB="${EDGE_UNIQUES_DB:-${216LABS_DB:-216labs.db}}"

python3 - "$DB" "$LIMIT" <<'PY'
import sqlite3, sys

db_path, limit = sys.argv[1], int(sys.argv[2])
conn = sqlite3.connect(db_path)
try:
    rows = conn.execute(
        """SELECT created_at, kind, email, substr(message,1,80), source_app_id
           FROM lead_event ORDER BY created_at DESC LIMIT ?""",
        (limit,),
    ).fetchall()
finally:
    conn.close()

if not rows:
    print("(no leads)")
    raise SystemExit(0)

for created_at, kind, email, message, source in rows:
    msg = (message or "").replace("\n", " ")
    print(f"{created_at}\t{kind}\t{email}\t{source}\t{msg}")
PY
