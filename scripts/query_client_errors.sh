#!/usr/bin/env bash
# Recent client/server errors ingested into 216labs.db (client_error_event).
# Usage: ./scripts/query_client_errors.sh [app_id] [hours]
# Example: ./scripts/query_client_errors.sh anchor 24
# All apps last 6h: ./scripts/query_client_errors.sh '' 6

set -euo pipefail

APP_ID="${1:-}"
HOURS="${2:-24}"

if ! [[ "$HOURS" =~ ^[0-9]+$ ]] || [ "$HOURS" -lt 1 ] || [ "$HOURS" -gt 720 ]; then
  echo "hours must be 1–720" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${CLIENT_ERRORS_DB:-$ROOT/216labs.db}"

run_sql() {
  local sql="$1"
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 -header -column "$DB" "$sql"
    return
  fi
  if [ -f "$DB" ] && command -v docker >/dev/null 2>&1; then
    local admin_cid
    admin_cid="$(docker ps --filter 'name=admin' --format '{{.Names}}' 2>/dev/null | head -1)"
    if [ -n "$admin_cid" ]; then
      docker exec -i "$admin_cid" node -e "
        const Database = require('better-sqlite3');
        const db = new Database('/app/216labs.db', { readonly: true });
        const rows = db.prepare(process.argv[1]).all();
        if (!rows.length) process.exit(0);
        const cols = Object.keys(rows[0]);
        const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
        const line = (cells) => cells.map((cell, i) => String(cell ?? '').padEnd(w[i])).join('  ');
        console.log(line(cols));
        for (const r of rows) console.log(line(cols.map((c) => r[c])));
      " "$sql"
      return
    fi
  fi
  echo "Need sqlite3 or a running admin container with $DB mounted at /app/216labs.db" >&2
  exit 1
}

if [ ! -f "$DB" ]; then
  echo "DB not found: $DB" >&2
  exit 1
fi

if [ -n "$APP_ID" ]; then
  if ! [[ "$APP_ID" =~ ^[a-z0-9][a-z0-9.-]*$ ]]; then
    echo "Invalid app_id" >&2
    exit 1
  fi
  run_sql "SELECT occurred_at, kind, substr(message,1,80) AS message, url
     FROM client_error_event
     WHERE app_id = '$APP_ID'
       AND datetime(occurred_at) >= datetime('now', '-$HOURS hours')
     ORDER BY datetime(occurred_at) DESC
     LIMIT 50;"
else
  run_sql "SELECT occurred_at, app_id, kind, substr(message,1,60) AS message, COUNT(*) AS n
     FROM client_error_event
     WHERE datetime(occurred_at) >= datetime('now', '-$HOURS hours')
     GROUP BY app_id, kind, substr(message,1,60)
     ORDER BY MAX(datetime(occurred_at)) DESC
     LIMIT 40;"
fi
