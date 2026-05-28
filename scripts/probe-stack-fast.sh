#!/usr/bin/env bash
# Fast health probes for the droplet: edge, activator, cron-runner, revenue readiness.
# Usage: ./scripts/probe-stack-fast.sh [user@host]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"

fail=0

echo "=== probe-stack-fast ($REMOTE) ==="

echo
echo "== Edge smoke =="
if "$ROOT/scripts/edge-smoke.sh"; then
  :
else
  fail=1
fi

echo
echo "== Activator =="
if "$ROOT/scripts/probe-activator-health.sh" "$REMOTE"; then
  :
else
  fail=1
fi

echo
echo "== Cron-runner =="
if "$ROOT/scripts/probe-cron-runner-health.sh" "$REMOTE"; then
  :
else
  fail=1
fi

echo
echo "== Revenue / checkout (public HTTP) =="
if "$ROOT/scripts/check-revenue-env-http.sh"; then
  :
else
  fail=1
fi

echo
if [[ "$fail" -ne 0 ]]; then
  echo "probe-stack-fast: FAIL (see sections above)" >&2
  exit 1
fi
echo "probe-stack-fast: OK"

