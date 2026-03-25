#!/usr/bin/env bash
# Pull TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_ID, and TELEGRAM_ALLOWED_USER_IDS from the droplet admin SQLite DB into
# internal/admin/pocket-cursor-bridge/.env.admin-sync (merged by pocket_cursor.py; optional .env overrides).
#
# Prereq: SSH access (same as deploy). Set values in admin → Env first.
# Usage:
#   ./scripts/sync-pocket-bridge-env.sh
#   POCKET_REMOTE=user@host POCKET_REMOTE_DB=/opt/216labs/216labs.db ./scripts/sync-pocket-bridge-env.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE="${POCKET_REMOTE:-root@46.101.88.197}"
REMOTE_DB="${POCKET_REMOTE_DB:-/opt/216labs/216labs.db}"
OUT="$ROOT/internal/admin/pocket-cursor-bridge/.env.admin-sync"

ssh -o BatchMode=yes -o ConnectTimeout=20 "$REMOTE" bash -s -- "$REMOTE_DB" <<'REMOTE' >"$OUT.tmp"
set -euo pipefail
DB="$1"
sqlite3 "$DB" "SELECT key || '=' || value FROM env_vars WHERE key IN ('TELEGRAM_BOT_TOKEN','TELEGRAM_OWNER_ID','TELEGRAM_ALLOWED_USER_IDS') AND value IS NOT NULL AND trim(value) != '';"
REMOTE
mv "$OUT.tmp" "$OUT"
lines=$(wc -l <"$OUT" | tr -d ' ')
echo "Wrote $OUT ($lines lines from $REMOTE)"
