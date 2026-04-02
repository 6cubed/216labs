#!/usr/bin/env bash
# Unique edge visitors (coarse: daily hash of IP + User-Agent) rolled up from Caddy logs.
# Usage: ./scripts/query_edge_uniques.sh <app_id> [days]
# Example: ./scripts/query_edge_uniques.sh onefit 7
# DB: repo-root 216labs.db or set EDGE_UNIQUES_DB.

set -euo pipefail
APP_ID="${1:?usage: $0 <app_id> [days]}"
DAYS="${2:-7}"

if ! [[ "$APP_ID" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Invalid app_id (use manifest id, e.g. onefit)" >&2
  exit 1
fi
if ! [[ "$DAYS" =~ ^[0-9]+$ ]] || [ "$DAYS" -lt 1 ] || [ "$DAYS" -gt 366 ]; then
  echo "days must be 1–366" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${EDGE_UNIQUES_DB:-$ROOT/216labs.db}"

if [ ! -f "$DB" ]; then
  echo "DB not found: $DB" >&2
  exit 1
fi

sqlite3 "$DB" "SELECT COUNT(DISTINCT visitor_hash) AS unique_visitors
FROM edge_visitor_day
WHERE app_id = '$APP_ID'
  AND day_utc >= date('now', '-$DAYS days');"
