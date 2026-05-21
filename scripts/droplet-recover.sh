#!/usr/bin/env bash
# Recover a stressed 216labs droplet: disk prune, pull main, restart edge + revenue apps.
# Usage: ./scripts/droplet-recover.sh [user@host]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"

if ! ssh -o ConnectTimeout=20 -o BatchMode=yes "$REMOTE" 'echo ok' 2>/dev/null | grep -q ok; then
  echo "SSH to $REMOTE failed (timeout or key)." >&2
  echo "Next: DigitalOcean console → power cycle or resize disk; then re-run this script." >&2
  echo "See docs/DROPLET-RECOVERY.md" >&2
  exit 1
fi

echo "=== Disk before prune ==="
ssh -o ConnectTimeout=25 "$REMOTE" 'df -h / | tail -1'

"$ROOT/scripts/prune-droplet-docker.sh" "$REMOTE" || true

ssh -o ConnectTimeout=120 "$REMOTE" 'set -euo pipefail
cd /opt/216labs
git pull -q
docker compose up -d caddy activator admin landing maxlearn storybook 1pageresearch
docker compose ps caddy activator admin maxlearn storybook 1pageresearch
'

echo
echo "=== Smoke probes (from laptop) ==="
curl -sS -m 12 -o /dev/null -w "admin:%{http_code}\n" https://admin.6cubed.app/ || true
curl -sS -m 12 https://maxlearn.6cubed.app/api/seed-status 2>/dev/null || true
echo
"$ROOT/scripts/check-revenue-env-http.sh" || true
