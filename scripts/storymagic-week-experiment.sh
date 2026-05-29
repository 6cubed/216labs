#!/usr/bin/env bash
# Kick off the one-week StoryMagic revenue experiment (<30 min CEO start).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CAMPAIGN="week_experiment_$(date +%Y%m%d)"
POST_URL="https://storybook.6cubed.app?utm_source=meta&utm_medium=organic&utm_campaign=${CAMPAIGN}"

echo "StoryMagic week experiment — $(date +%Y-%m-%d)"
echo ""
echo "1. Enable payments (~2 min)"
echo "   ./scripts/open-first-sale.sh"
echo ""
echo "2. Post this tracked link once (pick your channel)"
echo "   ${POST_URL}"
echo ""
echo "3. Ask happy preview users to tap «Copy link to share» (referral UTMs)"
echo ""
"$ROOT/scripts/query_revenue_summary.sh" 2>/dev/null || true
echo ""
echo "Measure all week: GA4 preorder_click + waitlist_signup · Stripe Dashboard · admin Leads"
echo "Playbook: docs/STORYMAGIC-WEEK-EXPERIMENT.md"

if [[ "$(uname -s)" == "Darwin" ]]; then
  echo "${POST_URL}" | pbcopy 2>/dev/null && echo "" && echo "(Post URL copied to clipboard on macOS)"
fi
