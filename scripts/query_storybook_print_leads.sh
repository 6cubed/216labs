#!/usr/bin/env bash
# List StoryMagic print-interest leads from the droplet SQLite volume.
# Usage: ./scripts/query_storybook_print_leads.sh [user@host]
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"

ssh -o ConnectTimeout=25 -o BatchMode=yes "$REMOTE" "sqlite3 -header -column /opt/216labs/products/org-lifestyle/play/storybook/data/storybook.db \"
SELECT p.id, p.email, p.created_at, b.title
FROM print_interest p
LEFT JOIN books b ON p.book_id = b.id
ORDER BY p.created_at DESC
LIMIT 50;
\"" 2>/dev/null || {
  echo "No leads or DB unreachable (table may not exist until first signup)." >&2
  exit 1
}
