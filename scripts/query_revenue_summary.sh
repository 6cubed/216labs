#!/usr/bin/env bash
# Closest-to-revenue snapshot for CEO / Telegram / heartbeats.
set -euo pipefail

echo "216labs revenue — closest to cash"
echo ""

SM="$(curl -sS -m 15 "https://storybook.6cubed.app/api/checkout/ready" 2>/dev/null || echo '{}')"
python3 - <<'PY' "$SM"
import json, sys
raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
try:
    d = json.loads(raw)
except Exception:
    d = {}
ready = bool(d.get("ready"))
pre = bool(d.get("preorderConfigured"))
wc = d.get("waitlistCount") or 0
price = d.get("priceUsd") or "24.99"
print("1. StoryMagic — $%s hardcover" % price)
if ready:
    print("   Status: CHECKOUT OPEN (full Stripe)")
elif pre:
    print("   Status: PREORDER LIVE (Payment Link)")
else:
    print("   Status: BLOCKED — Payment Link or STORYBOOK_STRIPE_* keys")
    print("   Next: https://admin.6cubed.app/checkout-setup")
if wc:
    print("   Waitlist: %s families" % wc)
print("")
print("2. Merch — Printful URL on Checkout setup (/merch)")
print("3. 1PageResearch — ONEPAGE_STRIPE_* keys")
print("")
print("Telegram: /firstsale /checkout /waitlist")
print("Playbook: docs/STORYMAGIC-WEEK-EXPERIMENT.md")
PY
