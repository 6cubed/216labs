#!/usr/bin/env bash
# Outreach card (Telegram /firstsale and /work).
# Stripe Payment Link is not the blocker — see docs/REVENUE-STRATEGY.md.
set -euo pipefail

WAITLIST="$(curl -sS -m 8 "https://storybook.6cubed.app/api/checkout/ready" 2>/dev/null \
  | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)
    print(int(d.get('waitlistCount') or 0))
except Exception:
    print(0)" 2>/dev/null || echo 0)"

cat <<EOF
First €1 — send this to one person (not Stripe).

Human visitors last 7 days: ~0. Waitlist: ${WAITLIST}.
A checkout converts a fraction of visitors; any fraction of 0 is 0.

--- copy / forward below ---
216Labs takes paid work: production web apps, AI retainers (€5–15k / monthly), and specialist audio/ML pilots (CARFAC on hydrophone, drone, and bird audio).

Hire: https://6cubed.app/#work
Proof: https://github.com/6cubed/216labs/tree/main/colabs/carfac-sai-underwater
---

Leads land in admin → Leads. Strategy: docs/REVENUE-STRATEGY.md
Telegram: /work  (alias: /firstsale)
EOF
