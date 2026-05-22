#!/usr/bin/env bash
# Fast spine + revenue restart when SSH works but full recover is too heavy.
# Usage: ./scripts/droplet-spine-up.sh [user@host]
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"
SSH_OPTS=(-o ConnectTimeout=25 -o BatchMode=yes -o ServerAliveInterval=8 -o ServerAliveCountMax=4)

ssh "${SSH_OPTS[@]}" "$REMOTE" 'bash -s' <<'REMOTE'
set -euo pipefail
TO="/usr/bin/timeout"
cd /opt/216labs
git pull -q 2>/dev/null || true
SERVICES="caddy activator admin landing maxlearn storybook 1pageresearch cron-runner"
$TO 300 docker compose up -d $SERVICES 2>&1 | tail -6
$TO 30 docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>&1 | tail -2 \
  || $TO 30 docker compose restart caddy
$TO 45 docker compose ps $SERVICES
REMOTE

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo
"$ROOT/scripts/edge-smoke.sh"
