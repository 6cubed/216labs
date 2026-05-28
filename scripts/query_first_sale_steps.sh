#!/usr/bin/env bash
# StoryMagic first-sale checklist (Telegram /firstsale).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "First sale — StoryMagic (~2 min)"
echo ""
echo "1. Stripe Payment Link \$24.99"
echo "   https://dashboard.stripe.com/test/payment-links/create"
echo "2. Paste on Checkout setup → Save & reload StoryMagic"
echo "   https://admin.6cubed.app/checkout-setup"
echo ""
"$ROOT/scripts/query_storybook_waitlist_summary.sh" 2>/dev/null || true
echo ""
echo "Week experiment: docs/STORYMAGIC-WEEK-EXPERIMENT.md"
echo "Local opener: ./scripts/open-first-sale.sh"
