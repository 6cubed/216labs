#!/usr/bin/env bash
# Confirm production edge is reachable; print revenue next step when checkout is not ready.
# Usage: ./scripts/lights-on.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Lights on check ==="
if ! "$ROOT/scripts/edge-smoke.sh"; then
  echo
  echo "Edge down — ./scripts/droplet-recover.sh (see docs/DROPLET-RECOVERY.md)"
  exit 1
fi

echo
echo "Edge OK. Checking paid checkout readiness..."
if "$ROOT/scripts/check-revenue-env-http.sh"; then
  echo "Revenue probes passed."
  exit 0
fi

echo
echo "Next revenue move: https://admin.6cubed.app/env — set STORYBOOK_STRIPE_* (Save hot-reloads storybook)."
echo "Guide: $ROOT/docs/FIRST-SALE.md"
exit 0
