#!/usr/bin/env bash
# Recent client/server errors ingested into 216labs.db (client_error_event).
# Usage:
#   ./scripts/query_client_errors.sh [app_id] [hours]
#   ./scripts/query_client_errors.sh --summary [hours]
#   ./scripts/query_client_errors.sh --remote [user@host] --summary [hours]
# Examples:
#   ./scripts/query_client_errors.sh anchor 24
#   ./scripts/query_client_errors.sh --summary 24
#   ./scripts/query_client_errors.sh --remote root@46.101.88.197 --summary 6

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${CLIENT_ERRORS_DB:-$ROOT/216labs.db}"
REMOTE_HOST=""

ARGS=("$@")
if [[ "${ARGS[0]:-}" == "--remote" ]]; then
  REMOTE_HOST="${ARGS[1]:-root@46.101.88.197}"
  ARGS=("${ARGS[@]:2}")
  REMOTE_DB="${QUERY_REMOTE_DB:-/opt/216labs/216labs.db}"
  REMOTE_DIR="${QUERY_REMOTE_DIR:-/opt/216labs}"
  REMOTE_ARGS=()
  for a in "${ARGS[@]}"; do
    REMOTE_ARGS+=("$(printf '%q' "$a")")
  done
  # shellcheck disable=SC2029
  ssh "$REMOTE_HOST" "cd $(printf '%q' "$REMOTE_DIR") && CLIENT_ERRORS_DB=$(printf '%q' "$REMOTE_DB") ./scripts/query_client_errors.sh ${REMOTE_ARGS[*]}"
  exit $?
fi

SUMMARY=0
APP_ID=""
HOURS=24

if [[ "${ARGS[0]:-}" == "--summary" ]]; then
  SUMMARY=1
  HOURS="${ARGS[1]:-24}"
else
  APP_ID="${ARGS[0]:-}"
  HOURS="${ARGS[1]:-24}"
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
  echo "Need sqlite3, a local DB at $DB, or: ./scripts/query_client_errors.sh --remote user@host --summary $HOURS" >&2
  exit 1
}

if [ ! -f "$DB" ]; then
  echo "DB not found: $DB (try --remote user@droplet)" >&2
  exit 1
fi

if [ "$SUMMARY" -eq 1 ]; then
  echo "Per-app error signals (reported last ${HOURS}h + current runtime failures)"
  HAS_RUNTIME_COLS=0
  if command -v sqlite3 >/dev/null 2>&1 && [ -f "$DB" ]; then
    if sqlite3 "$DB" "SELECT 1 FROM pragma_table_info('apps') WHERE name='last_runtime_error' LIMIT 1;" 2>/dev/null | grep -q 1; then
      HAS_RUNTIME_COLS=1
    fi
  fi
  if [ "$HAS_RUNTIME_COLS" -eq 1 ]; then
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
  else
    run_sql "SELECT app_id,
       COUNT(*) AS reported,
       '' AS runtime_fail
     FROM client_error_event
     WHERE datetime(occurred_at) >= datetime('now', '-${HOURS} hours')
     GROUP BY app_id
     ORDER BY reported DESC, app_id ASC;"
  fi
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
