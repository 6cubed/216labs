#!/usr/bin/env bash
# StoryMagic first-sale checklist (Telegram /firstsale).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "First sale — StoryMagic"
echo ""

READY_JSON="$(curl -sS -m 15 "https://storybook.6cubed.app/api/checkout/ready" 2>/dev/null || echo '{}')"
python3 - <<'PY' "$READY_JSON"
import json, sys
raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
try:
    d = json.loads(raw)
except Exception:
    d = {}
if d.get("ready"):
    print("Status: CHECKOUT OPEN")
elif d.get("preorderConfigured"):
    print("Status: PREORDER LIVE — blast waitlist + drive traffic")
else:
    print("Status: BLOCKED — enable preorder")
    print("")
    print("Fast path (if STORYBOOK_STRIPE_SECRET_KEY is in admin Env):")
    print("  1. https://admin.6cubed.app/env — paste sk_test_… or sk_live_…")
    print("  2. https://admin.6cubed.app/checkout-setup — Create Payment Link ($24.99)")
    print("")
    print("Manual fallback:")
    print("  1. https://dashboard.stripe.com/test/payment-links/create")
    print("  2. Paste URL on Checkout setup → Save")
wc = d.get("waitlistCount")
if wc:
    print("")
    print("Production waitlist:", wc, "families (public count)")
PY

echo ""
"$ROOT/scripts/query_storybook_waitlist_summary.sh" 2>/dev/null || true
echo ""
echo "Week experiment: docs/STORYMAGIC-WEEK-EXPERIMENT.md"
echo "Local opener: ./scripts/open-first-sale.sh"
