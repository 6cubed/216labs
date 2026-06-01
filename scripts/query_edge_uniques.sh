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

HAS_TABLE="$(sqlite3 "$DB" "SELECT 1 FROM sqlite_master WHERE type='table' AND name='edge_visitor_day' LIMIT 1;" 2>/dev/null || true)"
if [ "$HAS_TABLE" != "1" ]; then
  echo "edge uniques not available in DB: missing table edge_visitor_day" >&2
  echo "DB: $DB" >&2
  echo "Next:" >&2
  echo "  - On the droplet, ensure Caddy access logs + rollup cron are running (edge-visitor-rollup)" >&2
  echo "  - Or point this script at a DB that has the rollup table via EDGE_UNIQUES_DB=/path/to/216labs.db" >&2
  exit 2
fi

sqlite3 "$DB" "SELECT COUNT(DISTINCT visitor_hash) AS unique_visitors
FROM edge_visitor_day
WHERE app_id = '$APP_ID'
  AND day_utc >= date('now', '-$DAYS days');"
