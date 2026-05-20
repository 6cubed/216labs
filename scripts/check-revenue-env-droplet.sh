#!/usr/bin/env bash
# Report whether paid-app containers have revenue env vars set (admin Env → compose → container).
# Falls back to HTTP probes when SSH is unavailable.
# Usage: ./scripts/check-revenue-env-droplet.sh [user@host]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"

if ! ssh -o ConnectTimeout=12 -o BatchMode=yes "$REMOTE" 'echo ok' 2>/dev/null | grep -q ok; then
  echo "SSH to $REMOTE unavailable — using HTTP checkout probes instead." >&2
  exec "$ROOT/scripts/check-revenue-env-http.sh"
fi

ssh -o ConnectTimeout=25 -o BatchMode=yes "$REMOTE" 'set -euo pipefail
probe() {
  local svc="$1"
  local label="$2"
  shift 2
  local cname
  cname="$(docker ps --format "{{.Names}}" | grep -E "216labs-${svc}-[0-9]+$" | head -1 || true)"
  if [[ -z "$cname" ]]; then
    echo "[$label] container not running"
    return
  fi
  echo "=== $label ($cname) ==="
  for key in "$@"; do
    val="$(docker exec "$cname" printenv "$key" 2>/dev/null || true)"
    if [[ -n "${val:-}" ]]; then
      echo "  OK  $key (set)"
    else
      echo "  MISS $key"
    fi
  done
}

probe storybook StoryMagic \
  STORYBOOK_STRIPE_SECRET_KEY STORYBOOK_STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY

probe merch Merch NEXT_PUBLIC_MERCH_STORE_URL

probe 1pageresearch 1PageResearch \
  ONEPAGE_STRIPE_SECRET_KEY ONEPAGE_STRIPE_WEBHOOK_SECRET
'
