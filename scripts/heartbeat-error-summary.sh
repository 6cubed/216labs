#!/usr/bin/env bash
# One-glance client/server error summary for heartbeats (last N hours).
# Usage: ./scripts/heartbeat-error-summary.sh [hours]
# Uses local 216labs.db, admin container, or --remote droplet query.
set -euo pipefail

HOURS="${1:-6}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${CLIENT_ERRORS_DB:-$ROOT/216labs.db}"
REMOTE="${HEARTBEAT_QUERY_REMOTE:-root@46.101.88.197}"

echo "=== Client/server errors (last ${HOURS}h) ==="

if [[ -f "$DB" ]]; then
  "$ROOT/scripts/query_client_errors.sh" --summary "$HOURS"
  exit 0
fi

if docker ps --filter 'name=admin' --format '{{.Names}}' 2>/dev/null | grep -q .; then
  "$ROOT/scripts/query_client_errors.sh" --summary "$HOURS"
  exit 0
fi

if command -v ssh >/dev/null 2>&1; then
  echo "(querying droplet via SSH)"
  "$ROOT/scripts/query_client_errors.sh" --remote "$REMOTE" --summary "$HOURS"
  exit 0
fi

echo "No local DB and SSH unavailable." >&2
exit 1
