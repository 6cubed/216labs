#!/usr/bin/env bash
# Open Stripe + admin Checkout setup for StoryMagic first sale (macOS).
set -euo pipefail

open "https://dashboard.stripe.com/test/payment-links/create" 2>/dev/null || true
open "https://admin.6cubed.app/checkout-setup" 2>/dev/null || true
echo ""
echo "Fast path (~2 min): create Payment Link → paste on Checkout setup → Save."
echo "Full checkout: also add webhook at https://storybook.6cubed.app/api/webhook (checkout.session.completed)"
open "https://dashboard.stripe.com/test/apikeys" 2>/dev/null || true
open "https://dashboard.stripe.com/test/webhooks" 2>/dev/null || true
echo ""
echo "Week experiment playbook: docs/STORYMAGIC-WEEK-EXPERIMENT.md"
echo "Verify: ./scripts/query_storybook_waitlist_summary.sh"
echo "       ./scripts/check-revenue-env-http.sh"
