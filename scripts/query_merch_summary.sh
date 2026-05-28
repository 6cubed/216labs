#!/usr/bin/env bash
# Merch catalog + storefront status (Telegram /merch, CEO ops).
set -euo pipefail

HTML="$(curl -sS -m 25 -L "https://merch.6cubed.app/" 2>/dev/null || true)"
STATUS="$(echo "$HTML" | python3 -c "
import sys
html = sys.stdin.read()
if not html.strip():
    print('unreachable')
elif 'Warming up merch' in html or ('Starting...' in html and '6³ wordmark' not in html):
    print('warmup')
elif 'Shop via StoryMagic' in html or 'Support via StoryMagic' in html:
    print('fallback')
elif 'Open storefront' in html or '6³ wordmark tee' in html:
    print('live')
else:
    print('unknown')
" 2>/dev/null || echo "unknown")"

echo "Merch catalog (designed SKUs):"
echo "  • 6³ wordmark tee (\$28) · 216Labs stack tee (\$28)"
echo "  • Production-grade vibes hoodie (\$64, limited)"
echo "  • Cube snapback · sticker sheet · tote · enamel mug · crew socks"
echo ""
case "$STATUS" in
  live) echo "Storefront: LIVE — Buy opens your Printful/partner URL" ;;
  fallback) echo "Storefront: fallback — Buy routes to StoryMagic until NEXT_PUBLIC_MERCH_STORE_URL is set" ;;
  warmup) echo "Storefront: warmup — retry in ~30s" ;;
  unreachable) echo "Storefront: unreachable at https://merch.6cubed.app/" ;;
  *) echo "Storefront: unknown (check merch container)" ;;
esac
echo "Setup: https://admin.6cubed.app/checkout-setup"
echo "Browse: https://merch.6cubed.app"
