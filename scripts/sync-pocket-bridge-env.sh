#!/usr/bin/env bash
# Pull team env from the droplet admin SQLite DB into
# internal/admin/pocket-cursor-bridge/.env.admin-sync (merged by pocket_cursor.py; optional .env overrides).
#
# Keys: TELEGRAM_*, AGITWEET_API_TOKEN, plus AGITWEET_BASE_URL (public edge URL for the bridge).
#
# Prereq: SSH access (same as deploy). Set values in admin → Env first.
# Usage:
#   ./scripts/sync-pocket-bridge-env.sh
#   POCKET_REMOTE=user@host POCKET_REMOTE_DB=/opt/216labs/216labs.db ./scripts/sync-pocket-bridge-env.sh
#   APP_HOST=6cubed.app ./scripts/sync-pocket-bridge-env.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE="${POCKET_REMOTE:-root@46.101.88.197}"
REMOTE_DB="${POCKET_REMOTE_DB:-/opt/216labs/216labs.db}"
APP_HOST="${APP_HOST:-6cubed.app}"
OUT="$ROOT/internal/admin/pocket-cursor-bridge/.env.admin-sync"

ssh -o BatchMode=yes -o ConnectTimeout=20 "$REMOTE" bash -s -- "$REMOTE_DB" <<'REMOTE' >"$OUT.tmp"
set -euo pipefail
DB="$1"
python3 - "$DB" <<'PY'
import sqlite3
import sys

db = sys.argv[1]
keys = (
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_OWNER_ID",
    "TELEGRAM_ALLOWED_USER_IDS",
    "AGITWEET_API_TOKEN",
)
conn = sqlite3.connect(db)
for key in keys:
    row = conn.execute(
        "SELECT value FROM env_vars WHERE key = ? AND value IS NOT NULL AND trim(value) != ''",
        (key,),
    ).fetchone()
    if row:
        val = str(row[0]).replace("\n", "").replace("\r", "")
        print(f"{key}={val}")
PY
REMOTE

{
  cat "$OUT.tmp"
  echo "AGITWEET_BASE_URL=https://agitweet.${APP_HOST}"
} >"$OUT"
rm -f "$OUT.tmp"
lines=$(wc -l <"$OUT" | tr -d ' ')
echo "Wrote $OUT ($lines lines from $REMOTE, agitweet host $APP_HOST)"
