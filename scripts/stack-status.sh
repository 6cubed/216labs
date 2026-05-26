#!/usr/bin/env bash
# One-line stack + revenue + local bridge status (Telegram: "is it running?").
# Usage: ./scripts/stack-status.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 216labs stack status ==="
echo

if "$ROOT/scripts/edge-smoke.sh"; then
  echo "Edge: UP"
else
  echo "Edge: DEGRADED — ./scripts/heartbeat-recover.sh or ./scripts/droplet-reboot.sh"
fi

echo
if "$ROOT/scripts/check-revenue-env-http.sh" 2>/dev/null; then
  echo "Revenue: checkout ready"
else
  echo "Revenue: keys pending — https://admin.6cubed.app/env (StoryMagic: 2 Stripe keys)"
fi

echo
if pgrep -f 'pocket_cursor\.py' >/dev/null 2>&1; then
  if curl -sf -m 2 http://127.0.0.1:9222/json/version >/dev/null 2>&1; then
    echo "Pocket bridge: running (CDP ok)"
  else
    echo "Pocket bridge: process up, CDP not responding — restart ./scripts/pocket-cursor-bridge.sh"
  fi
else
  echo "Pocket bridge: not running — ./scripts/pocket-cursor-bridge.sh"
fi
