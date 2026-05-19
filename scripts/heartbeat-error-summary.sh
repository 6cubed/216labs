#!/usr/bin/env bash
# One-glance client/server error summary for heartbeats (last N hours).
# Usage: ./scripts/heartbeat-error-summary.sh [hours]
# Exits 1 if any app has events (optional signal for "needs attention").
set -euo pipefail

HOURS="${1:-6}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${CLIENT_ERRORS_DB:-$ROOT/216labs.db}"

if [ ! -f "$DB" ]; then
  echo "No DB at $DB — set CLIENT_ERRORS_DB or run on droplet with admin volume." >&2
  exit 1
fi

SQL="SELECT app_id, kind, COUNT(*) AS n, MAX(occurred_at) AS latest
     FROM client_error_event
     WHERE datetime(occurred_at) >= datetime('now', '-${HOURS} hours')
     GROUP BY app_id, kind
     ORDER BY n DESC, latest DESC
     LIMIT 30;"

echo "=== Client/server errors (last ${HOURS}h) ==="
if command -v sqlite3 >/dev/null 2>&1; then
  COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM client_error_event WHERE datetime(occurred_at) >= datetime('now', '-${HOURS} hours');")
  if [ "${COUNT:-0}" = "0" ]; then
    echo "No events in window."
    exit 0
  fi
  sqlite3 -header -column "$DB" "$SQL"
  exit 0
fi

# Droplet: use admin container
ADMIN=$(docker ps --filter 'name=admin' --format '{{.Names}}' 2>/dev/null | head -1)
if [ -z "$ADMIN" ]; then
  echo "Need sqlite3 or running admin container." >&2
  exit 1
fi
docker exec -i "$ADMIN" node -e "
const Database = require('better-sqlite3');
const db = new Database('/app/216labs.db', { readonly: true });
const hours = ${HOURS};
const n = db.prepare(\"SELECT COUNT(*) AS c FROM client_error_event WHERE datetime(occurred_at) >= datetime('now', '-' || ? || ' hours')\").get(hours).c;
if (!n) { console.log('No events in window.'); process.exit(0); }
const rows = db.prepare(\`SELECT app_id, kind, COUNT(*) AS n, MAX(occurred_at) AS latest FROM client_error_event WHERE datetime(occurred_at) >= datetime('now', '-' || ? || ' hours') GROUP BY app_id, kind ORDER BY n DESC LIMIT 30\`).all(hours);
console.log('app_id           kind     n  latest');
for (const r of rows) console.log([r.app_id, r.kind, r.n, r.latest].join('  '));
"
