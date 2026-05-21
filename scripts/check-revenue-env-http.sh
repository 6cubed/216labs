#!/usr/bin/env bash
# Paid-checkout readiness via public HTTP (no SSH). Complements check-revenue-env-droplet.sh.
set -euo pipefail

fail=0

check_json_ready() {
  local label="$1"
  local url="$2"
  local body
  body="$(curl -sS -m 25 -L "$url" 2>/dev/null || true)"
  if [[ -z "$body" ]]; then
    echo "[$label] unreachable: $url"
    fail=1
    return
  fi
  if ! echo "$body" | grep -q '"ready"'; then
    echo "[$label] no JSON at $url (container stopped or activator warmup — see docs/REVENUE-ENV.md)"
    fail=1
    return
  fi
  if echo "$body" | grep -q '"ready"[[:space:]]*:[[:space:]]*true'; then
    echo "[$label] checkout ready ($url)"
  else
    echo "[$label] checkout NOT ready ($url)"
    echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ', d.get('message',''))" 2>/dev/null || echo "  $body"
    fail=1
  fi
}

check_json_ready "StoryMagic" "https://storybook.6cubed.app/api/checkout/ready"
check_json_ready "1PageResearch" "https://1pageresearch.6cubed.app/api/checkout/ready"

merch_html="$(curl -sS -m 25 -L "https://merch.6cubed.app/" 2>/dev/null || true)"
if [[ -z "$merch_html" ]]; then
  echo "[Merch] unreachable: https://merch.6cubed.app/"
  fail=1
elif echo "$merch_html" | grep -qE 'Checkout URL not configured|Shop StoryMagic'; then
  echo "[Merch] NEXT_PUBLIC_MERCH_STORE_URL not active (Buy uses StoryMagic fallback)"
  fail=1
else
  echo "[Merch] storefront URL appears configured"
fi

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "Set keys in admin Env — see docs/REVENUE-ENV.md"
  exit 1
fi
echo
echo "All paid checkout probes passed."
