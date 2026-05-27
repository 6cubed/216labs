#!/usr/bin/env bash
# Open Stripe + admin Env tabs for StoryMagic first sale (macOS).
set -euo pipefail

open "https://dashboard.stripe.com/test/apikeys" 2>/dev/null || true
open "https://dashboard.stripe.com/test/webhooks" 2>/dev/null || true
echo "  Webhook URL: https://storybook.6cubed.app/api/webhook"
echo "  Event: checkout.session.completed"
open "https://admin.6cubed.app/checkout-setup" 2>/dev/null || true
open "https://admin.6cubed.app/env" 2>/dev/null || true
echo "Opened: Stripe keys, webhook create (verify URL), checkout-setup + Env."
echo "Then: ./scripts/check-revenue-env-http.sh"
