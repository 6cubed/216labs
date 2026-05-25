#!/usr/bin/env bash
# Fast parallel edge smoke (under ~15s). Heartbeats run this first when the droplet may be down.
# Usage: ./scripts/edge-smoke.sh
# Exit 0 = edge reachable; 1 = critical host unreachable or non-JSON revenue probe.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MAX="${EDGE_SMOKE_TIMEOUT:-10}"
fail=0
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

probe_http() {
  local id="$1" url="$2"
  local out="$tmpdir/$id"
  local code
  code="$(curl -sS -m "$MAX" -o "$out" -w '%{http_code}' "$url" 2>/dev/null || echo "000")"
  echo "$id $code" >>"$tmpdir/summary"
  if [[ "$code" == "000" ]]; then
    fail=1
  fi
}

probe_landing() {
  local code
  code="$(curl -sS -m "$MAX" -o /dev/null -w '%{http_code}' "https://6cubed.app/" 2>/dev/null || echo "000")"
  if [[ "$code" == "000" ]]; then
    code="$(curl -sS -m "$MAX" -o /dev/null -w '%{http_code}' "https://www.6cubed.app/" 2>/dev/null || echo "000")"
    if [[ "$code" != "000" ]]; then
      echo "landing $code (www)" >>"$tmpdir/summary"
      return
    fi
  fi
  echo "landing $code" >>"$tmpdir/summary"
  if [[ "$code" == "000" ]]; then
    fail=1
  fi
}

probe_json_ready() {
  local id="$1" url="$2"
  local out="$tmpdir/$id"
  local code body
  code="$(curl -sS -m "$MAX" -L -o "$out" -w '%{http_code}' "$url" 2>/dev/null || echo "000")"
  body="$(cat "$out" 2>/dev/null || true)"
  if [[ "$code" == "000" || -z "$body" ]]; then
    echo "$id FAIL unreachable" >>"$tmpdir/summary"
    fail=1
    return
  fi
  if ! echo "$body" | grep -q '"ready"'; then
    echo "$id FAIL non-json HTTP $code" >>"$tmpdir/summary"
    fail=1
    return
  fi
  local ready
  ready="$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ready'))" 2>/dev/null || echo "?")"
  echo "$id OK ready=$ready HTTP $code" >>"$tmpdir/summary"
}

probe_maxlearn() {
  local out="$tmpdir/maxlearn"
  local code body ready
  code="$(curl -sS -m "$MAX" -L -o "$out" -w '%{http_code}' "https://maxlearn.6cubed.app/api/seed-status" 2>/dev/null || echo "000")"
  body="$(cat "$out" 2>/dev/null || true)"
  if [[ "$code" != "000" && -n "$body" ]] && echo "$body" | grep -q '"ready"'; then
    ready="$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ready'))" 2>/dev/null || echo "?")"
    echo "maxlearn OK ready=$ready HTTP $code" >>"$tmpdir/summary"
    if [[ "$ready" == "True" || "$ready" == "true" ]]; then
      local sid="edge-smoke-$$"
      local next_out="$tmpdir/maxlearn-next"
      code="$(curl -sS -m "$MAX" -o "$next_out" -w '%{http_code}' \
        -H "X-MaxLearn-Session: $sid" "https://maxlearn.6cubed.app/api/next" 2>/dev/null || echo "000")"
      local sid_json snippet_id
      sid_json="$(python3 -c "import json; d=json.load(open('$next_out')); print(d.get('snippet',{}).get('id',''), d.get('session_id',''))" 2>/dev/null || echo "")"
      snippet_id="${sid_json%% *}"
      [[ -n "${sid_json#* }" && "${sid_json#* }" != "$sid_json" ]] && sid="${sid_json#* }"
      if [[ "$code" != "200" || -z "$snippet_id" ]]; then
        echo "maxlearn FAIL feed next HTTP $code" >>"$tmpdir/summary"
        fail=1
        return
      fi
      code="$(curl -sS -m "$MAX" -o /dev/null -w '%{http_code}' \
        -X POST -H "Content-Type: application/json" -H "X-MaxLearn-Session: $sid" \
        -d "{\"snippet_id\":$snippet_id}" "https://maxlearn.6cubed.app/api/skip" 2>/dev/null || echo "000")"
      if [[ "$code" != "200" ]]; then
        echo "maxlearn FAIL feed skip HTTP $code" >>"$tmpdir/summary"
        fail=1
        return
      fi
      code="$(curl -sS -m "$MAX" -o /dev/null -w '%{http_code}' \
        -H "X-MaxLearn-Session: $sid" "https://maxlearn.6cubed.app/api/next" 2>/dev/null || echo "000")"
      if [[ "$code" != "200" ]]; then
        echo "maxlearn FAIL feed after skip HTTP $code" >>"$tmpdir/summary"
        fail=1
        return
      fi
      echo "maxlearn OK feed swipe HTTP $code" >>"$tmpdir/summary"
    fi
    return
  fi
  code="$(curl -sS -m "$MAX" -o /dev/null -w '%{http_code}' "https://maxlearn.6cubed.app/healthz" 2>/dev/null || echo "000")"
  if [[ "$code" =~ ^[1-5][0-9]{2}$ ]]; then
    echo "maxlearn WARN up but seed-status missing HTTP $code" >>"$tmpdir/summary"
    fail=1
    return
  fi
  echo "maxlearn FAIL unreachable" >>"$tmpdir/summary"
  fail=1
}

echo "=== Edge smoke (timeout ${MAX}s) ==="

probe_http admin "https://admin.6cubed.app/" &
probe_landing &
probe_json_ready storybook "https://storybook.6cubed.app/api/checkout/ready" &
probe_json_ready onepage "https://1pageresearch.6cubed.app/api/checkout/ready" &
probe_maxlearn &
wait

sort "$tmpdir/summary" | while read -r line; do echo "  $line"; done

# Background jobs cannot update parent $fail — derive from summary.
if grep -qE ' (000|000000|FAIL unreachable)' "$tmpdir/summary" 2>/dev/null; then
  fail=1
fi
if grep -qE ' WARN ' "$tmpdir/summary" 2>/dev/null; then
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo
  if grep -qE ' (000|000000|FAIL unreachable)' "$tmpdir/summary" 2>/dev/null \
    && ! grep -qE ' OK ' "$tmpdir/summary" 2>/dev/null; then
    echo "Edge fully down — ./scripts/droplet-wedge-check.sh for diagnosis" >&2
  else
    echo "Edge degraded — ./scripts/droplet-spine-up.sh or ./scripts/droplet-recover.sh" >&2
  fi
  exit 1
fi
echo "edge-smoke: critical hosts reachable"
exit 0
