#!/usr/bin/env bash
# Recent client/server errors ingested into 216labs.db (client_error_event).
# Usage:
#   ./scripts/query_client_errors.sh [app_id] [hours]
#   ./scripts/query_client_errors.sh --summary [hours]
# Examples:
#   ./scripts/query_client_errors.sh anchor 24
#   ./scripts/query_client_errors.sh --summary 24

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${CLIENT_ERRORS_DB:-$ROOT/216labs.db}"

SUMMARY=0
APP_ID=""
HOURS=24

if [[ "${1:-}" == "--summary" ]]; then
  SUMMARY=1
  HOURS="${2:-24}"
else
  APP_ID="${1:-}"
  HOURS="${2:-24}"
fi

if ! [[ "$HOURS" =~ ^[0-9]+$ ]] || [ "$HOURS" -lt 1 ] || [ "$HOURS" -gt 720 ]; then
  echo "hours must be 1–720" >&2
  exit 1
fi

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

if [ "$SUMMARY" -eq 1 ]; then
  echo "Per-app error signals (reported last ${HOURS}h + current runtime failures)"
  run_sql "SELECT a.id AS app_id,
     COALESCE(e.reported, 0) AS reported,
     CASE
       WHEN (a.last_runtime_error IS NOT NULL AND TRIM(a.last_runtime_error) != '')
         OR TRIM(COALESCE(a.runtime_status, '')) = 'failed'
       THEN 'yes'
       ELSE ''
     END AS runtime_fail
   FROM apps a
   LEFT JOIN (
     SELECT app_id, COUNT(*) AS reported
     FROM client_error_event
     WHERE datetime(occurred_at) >= datetime('now', '-${HOURS} hours')
     GROUP BY app_id
   ) e ON e.app_id = a.id
   WHERE COALESCE(e.reported, 0) > 0
      OR (a.last_runtime_error IS NOT NULL AND TRIM(a.last_runtime_error) != '')
      OR TRIM(COALESCE(a.runtime_status, '')) = 'failed'
   ORDER BY reported DESC, a.id ASC;"
  exit 0
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
