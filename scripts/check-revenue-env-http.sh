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
    return
  fi
  preorder="$(echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('yes' if d.get('preorderConfigured') else 'no')
" 2>/dev/null || echo "no")"
  if [[ "$preorder" == "yes" && "$label" == "StoryMagic" ]]; then
    echo "[$label] preorder LIVE (Payment Link) — full checkout still off ($url)"
    echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('operatorHint'):
    print('   hint:', d['operatorHint'])
" 2>/dev/null || true
    return
  fi
  echo "[$label] checkout NOT ready ($url)"
  echo "$body" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('  ', d.get('message', ''))
if d.get('setupUrl'):
    print('   setup:', d['setupUrl'])
if d.get('operatorHint'):
    print('   hint:', d['operatorHint'])
if d.get('missingKeys'):
    print('   missing:', ', '.join(d['missingKeys']))
wc = d.get('waitlistCount')
if wc is not None and wc > 0:
    print('   waitlist:', wc, 'families')
" 2>/dev/null || echo "  $body"
  fail=1
}

check_json_ready "StoryMagic" "https://storybook.6cubed.app/api/checkout/ready"
check_json_ready "1PageResearch" "https://1pageresearch.6cubed.app/api/checkout/ready"

merch_classify() {
  echo "$1" | python3 -c "
import sys
html = sys.stdin.read()
warmup = 'Warming up merch' in html or ('Starting...' in html and '6³ wordmark' not in html)
fallback = (
    'Shop via StoryMagic' in html
    or 'Support via StoryMagic' in html
    or 'Checkout URL not configured' in html
)
live = 'Open storefront' in html or '6³ wordmark tee' in html
if warmup:
    print('warmup')
elif fallback:
    print('fallback')
elif live:
    print('live')
else:
    print('unknown')
" 2>/dev/null || echo "unknown"
}

merch_html=""
merch_live="unknown"
for attempt in 1 2 3; do
  merch_html="$(curl -sS -m 25 -L "https://merch.6cubed.app/" 2>/dev/null || true)"
  if [[ -z "$merch_html" ]]; then
    merch_live="unreachable"
    break
  fi
  merch_live="$(merch_classify "$merch_html")"
  if [[ "$merch_live" != "warmup" || "$attempt" -eq 3 ]]; then
    break
  fi
  sleep 18
done

if [[ "$merch_live" == "unreachable" || -z "$merch_html" ]]; then
  echo "[Merch] unreachable: https://merch.6cubed.app/"
  fail=1
else
  case "$merch_live" in
    live)
      echo "[Merch] storefront URL appears configured"
      ;;
    fallback)
      echo "[Merch] NEXT_PUBLIC_MERCH_STORE_URL not active (Buy uses StoryMagic fallback)"
      fail=1
      ;;
    warmup)
      echo "[Merch] activator warmup after retries (not blocking StoryMagic first sale)"
      ;;
    *)
      echo "[Merch] could not confirm storefront (unexpected page)"
      fail=1
      ;;
  esac
fi

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "Set keys: https://admin.6cubed.app/checkout-setup — docs/FIRST-SALE.md"
  exit 1
fi
echo
echo "All paid checkout probes passed."
