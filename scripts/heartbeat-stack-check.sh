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
HTML_FAIL=0

echo
HOURS="${HEARTBEAT_ERROR_HOURS:-6}"
"$ROOT/scripts/heartbeat-error-summary.sh" "$HOURS" || true

echo
echo "=== Public admin APIs ==="
LIVE_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 \
  "https://admin.6cubed.app/api/public/live-apps" 2>/dev/null || echo "000")
if [[ "$LIVE_CODE" == "200" ]]; then
  echo "live-apps: $LIVE_CODE"
else
  echo "WARN: admin /api/public/live-apps returned HTTP $LIVE_CODE (expect 200; restart caddy after Caddyfile route changes)" >&2
fi
INGEST_CODE=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 \
  -X POST "https://admin.6cubed.app/api/public/report-error" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://hello-nextjs.6cubed.app' \
  -d '{"app_id":"hello-nextjs","kind":"client","message":"heartbeat-stack-check probe"}' 2>/dev/null || echo "000")
if [[ "$INGEST_CODE" == "201" || "$INGEST_CODE" == "204" ]]; then
  echo "report-error ingest: $INGEST_CODE"
else
  echo "WARN: report-error ingest returned HTTP $INGEST_CODE (expect 201)" >&2
fi

HTML_CFG="$ROOT/config/errors-html-probe-apps.txt"
if [[ -f "$HTML_CFG" ]]; then
  echo
  echo "=== Live HTML (client error reporter) ==="
  HTML_FAIL=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    id="${line%%#*}"
    id="$(echo "$id" | tr -d '[:space:]')"
    [[ -z "$id" ]] && continue
    host="${id}.6cubed.app"
    [[ "$id" == "landing" ]] && host="6cubed.app"
    code=$(curl -sS -o /tmp/heartbeat-probe-$$.html -w '%{http_code}' --max-time 15 -L \
      "https://${host}/" 2>/dev/null || echo "000")
    if [[ "$code" != "200" ]]; then
      echo "  WARN: $id (https://${host}/): HTTP $code" >&2
      HTML_FAIL=$((HTML_FAIL + 1))
      continue
    fi
    if grep -q 'report-error' "/tmp/heartbeat-probe-$$.html" 2>/dev/null; then
      echo "  $id (https://${host}/): reporter in HTML"
    else
      echo "  WARN: $id (https://${host}/): HTTP 200 but no report-error in body (stale image?)" >&2
      HTML_FAIL=$((HTML_FAIL + 1))
    fi
  done <"$HTML_CFG"
  rm -f "/tmp/heartbeat-probe-$$.html"
  if ((HTML_FAIL > 0)); then
    echo "heartbeat-stack-check: $HTML_FAIL app(s) missing live client reporter in HTML" >&2
  fi
fi

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

EXIT_CODE="${AUDIT_EXIT:-0}"
if ((HTML_FAIL > 0)); then
  EXIT_CODE=1
fi
exit "$EXIT_CODE"
