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

_probe_public_host() {
  local id="$1"
  if [[ "$id" == "landing" ]]; then
    echo "6cubed.app"
  else
    echo "${id}.6cubed.app"
  fi
}

HTML_CFG="$ROOT/config/errors-html-probe-apps.txt"
SPA_CFG="$ROOT/config/errors-html-probe-spa-apps.txt"
if [[ -f "$HTML_CFG" || -f "$SPA_CFG" ]]; then
  echo
  echo "=== Live client error reporters ==="
  HTML_FAIL=0
  PROBE_HTML="/tmp/heartbeat-probe-$$.html"
  PROBE_JS="/tmp/heartbeat-probe-$$.js"
  if [[ -f "$HTML_CFG" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      id="${line%%#*}"
      id="$(echo "$id" | tr -d '[:space:]')"
      [[ -z "$id" ]] && continue
      host="$(_probe_public_host "$id")"
      code=$(curl -sS -o "$PROBE_HTML" -w '%{http_code}' --max-time 15 -L \
        "https://${host}/" 2>/dev/null || echo "000")
      if [[ "$code" != "200" ]]; then
        echo "  WARN: $id (https://${host}/): HTTP $code" >&2
        HTML_FAIL=$((HTML_FAIL + 1))
        continue
      fi
      if grep -q 'report-error' "$PROBE_HTML" 2>/dev/null; then
        echo "  $id (https://${host}/): reporter in HTML"
      else
        echo "  WARN: $id (https://${host}/): HTTP 200 but no report-error in HTML (stale image?)" >&2
        HTML_FAIL=$((HTML_FAIL + 1))
      fi
    done <"$HTML_CFG"
  fi
  if [[ -f "$SPA_CFG" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      id="${line%%#*}"
      id="$(echo "$id" | tr -d '[:space:]')"
      [[ -z "$id" ]] && continue
      host="$(_probe_public_host "$id")"
      code=$(curl -sS -o "$PROBE_HTML" -w '%{http_code}' --max-time 15 -L \
        "https://${host}/" 2>/dev/null || echo "000")
      if [[ "$code" != "200" ]]; then
        echo "  WARN: $id (https://${host}/): HTTP $code" >&2
        HTML_FAIL=$((HTML_FAIL + 1))
        continue
      fi
      js_path="$(grep -oE '/assets/[a-zA-Z0-9_.-]+\.js' "$PROBE_HTML" 2>/dev/null | head -1)"
      if [[ -z "$js_path" ]]; then
        js_path="$(grep -oE 'src="(/[^"]+\.js)"' "$PROBE_HTML" 2>/dev/null | head -1 | sed 's/src="//;s/"$//')"
      fi
      if [[ -z "$js_path" ]]; then
        echo "  WARN: $id (https://${host}/): no JS bundle path in index HTML" >&2
        HTML_FAIL=$((HTML_FAIL + 1))
        continue
      fi
      js_code=$(curl -sS -o "$PROBE_JS" -w '%{http_code}' --max-time 20 -L \
        "https://${host}${js_path}" 2>/dev/null || echo "000")
      if [[ "$js_code" != "200" ]]; then
        echo "  WARN: $id (https://${host}${js_path}): HTTP $js_code" >&2
        HTML_FAIL=$((HTML_FAIL + 1))
        continue
      fi
      if grep -q 'report-error' "$PROBE_JS" 2>/dev/null; then
        echo "  $id (https://${host}${js_path}): reporter in JS bundle"
      else
        echo "  WARN: $id: bundle has no report-error (stale image?)" >&2
        HTML_FAIL=$((HTML_FAIL + 1))
      fi
    done <"$SPA_CFG"
  fi
  rm -f "$PROBE_HTML" "$PROBE_JS"
  if ((HTML_FAIL > 0)); then
    echo "heartbeat-stack-check: $HTML_FAIL app(s) missing live client reporter" >&2
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
