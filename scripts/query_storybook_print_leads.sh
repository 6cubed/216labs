#!/usr/bin/env bash
# List StoryMagic print-interest leads from the droplet (includes ad UTMs when set).
# Usage: ./scripts/query_storybook_print_leads.sh [user@host] [limit]
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"
LIMIT="${2:-15}"
SQL="SELECT p.id, p.email,
       COALESCE(p.utm_source, '') AS utm_source,
       COALESCE(p.utm_medium, '') AS utm_medium,
       COALESCE(p.utm_campaign, '') AS utm_campaign,
       p.created_at, COALESCE(b.title, '') AS book_title
FROM print_interest p
LEFT JOIN books b ON p.book_id = b.id
ORDER BY p.created_at DESC
LIMIT ${LIMIT};"

run_sql() {
  local db_path="$1"
  ssh -o ConnectTimeout=25 -o BatchMode=yes "$REMOTE" \
    "sqlite3 -header -column '$db_path' \"$SQL\"" 2>/dev/null
}

# Prefer bind-mounted data on the host (when populated).
if run_sql "/opt/216labs/products/org-lifestyle/play/storybook/data/storybook.db"; then
  exit 0
fi

# Fallback: DB inside the running storybook container (/app/data).
CTR=$(ssh -o ConnectTimeout=25 -o BatchMode=yes "$REMOTE" \
  "docker ps --filter name=storybook --format '{{.Names}}' | head -1" 2>/dev/null || true)
if [[ -n "$CTR" ]]; then
  if ssh -o ConnectTimeout=25 -o BatchMode=yes "$REMOTE" \
    "docker exec '$CTR' sqlite3 /app/data/storybook.db \"$SQL\"" 2>/dev/null; then
    exit 0
  fi
fi

echo "No leads or DB unreachable (warm storybook with one /api/checkout/ready hit, then retry)." >&2
exit 1
