#!/usr/bin/env bash
# StoryMagic waitlist count + paid-path status (for Telegram /waitlist and ops).
# Usage: ./scripts/query_storybook_waitlist_summary.sh [user@host]
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"
SQL="SELECT COUNT(*) FROM print_interest;"

run_count() {
  local db_path="$1"
  ssh -o ConnectTimeout=20 -o BatchMode=yes "$REMOTE" \
    "sqlite3 '$db_path' \"$SQL\"" 2>/dev/null || echo "0"
}

COUNT="0"
if out=$(run_count "/opt/216labs/products/org-lifestyle/play/storybook/data/storybook.db"); then
  COUNT="${out:-0}"
else
  CTR=$(ssh -o ConnectTimeout=20 -o BatchMode=yes "$REMOTE" \
    "docker ps --filter name=storybook --format '{{.Names}}' | head -1" 2>/dev/null || true)
  if [[ -n "$CTR" ]]; then
    COUNT=$(ssh -o ConnectTimeout=20 -o BatchMode=yes "$REMOTE" \
      "docker exec '$CTR' sqlite3 /app/data/storybook.db \"$SQL\"" 2>/dev/null || echo "0")
  fi
fi

READY_JSON="$(curl -sS -m 15 "https://storybook.6cubed.app/api/checkout/ready" 2>/dev/null || echo '{}')"
PARSED="$(echo "$READY_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
ready = bool(d.get('ready'))
pre = bool(d.get('preorderConfigured'))
if ready:
    path = 'checkout open'
elif pre:
    path = 'preorder live'
else:
    path = 'no paid path'
print(path)
" 2>/dev/null || echo "unknown")"

echo "StoryMagic waitlist: ${COUNT} families"
echo "Paid path: ${PARSED}"
echo "Checkout setup: https://admin.6cubed.app/checkout-setup"
