#!/usr/bin/env bash
# Print the first-sale path (Stripe → admin Env → deploy → verify). No secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== First sale (StoryMagic) ==="
echo "Guide: $ROOT/docs/FIRST-SALE.md"
echo
echo "1. Stripe test keys + webhook → https://storybook.6cubed.app/api/webhook"
echo "2. Checkout setup → https://admin.6cubed.app/checkout-setup"
echo "   STORYBOOK_STRIPE_SECRET_KEY, STORYBOOK_STRIPE_WEBHOOK_SECRET (required)"
echo "   NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY (optional)"
echo "3. Deploy: DEPLOY_RUNTIME_APPS=storybook ./deploy.sh root@46.101.88.197"
echo "4. Verify:"
echo "   ./scripts/check-revenue-env-http.sh"
echo

if [[ "${1:-}" == "--probe" ]]; then
  "$ROOT/scripts/check-revenue-env-http.sh" || true
fi
