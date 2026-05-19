#!/usr/bin/env bash
# One command for heartbeats: error-reporting audit, DB summary, Node runtime image probes.
# Usage: ./scripts/heartbeat-stack-check.sh [--live]
#   --live  POST ingest probe per app (audit-client-error-reporting.sh --live)
# Env: CLIENT_ERRORS_DB, HEARTBEAT_ERROR_HOURS (default 6)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LIVE=0
[[ "${1:-}" == "--live" ]] && LIVE=1

echo "=== Heartbeat stack check ==="
echo

if [[ "$LIVE" == 1 ]]; then
  "$ROOT/scripts/audit-client-error-reporting.sh" --live
else
  "$ROOT/scripts/audit-client-error-reporting.sh"
fi
AUDIT_EXIT=$?

echo
HOURS="${HEARTBEAT_ERROR_HOURS:-6}"
"$ROOT/scripts/heartbeat-error-summary.sh" "$HOURS" || true

CFG="$ROOT/config/errors-runtime-services.txt"
if [[ -f "$CFG" ]] && command -v docker >/dev/null 2>&1; then
  echo
  echo "=== Node images (compiled @216labs/errors) ==="
  RUNTIME_FAIL=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    svc="${line%%#*}"
    svc="$(echo "$svc" | tr -d '[:space:]')"
    [[ -z "$svc" ]] && continue
    img="216labs/${svc}:latest"
    if docker image inspect "$img" >/dev/null 2>&1; then
      if "$ROOT/scripts/verify-image-errors-runtime.sh" "$img"; then
        :
      else
        RUNTIME_FAIL=$((RUNTIME_FAIL + 1))
      fi
    else
      echo "skip $img (not present locally)"
    fi
  done <"$CFG"
  if ((RUNTIME_FAIL > 0)); then
    echo "heartbeat-stack-check: $RUNTIME_FAIL runtime image(s) failed" >&2
    exit 1
  fi
fi

exit "${AUDIT_EXIT:-0}"
