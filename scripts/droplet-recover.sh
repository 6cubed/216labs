#!/usr/bin/env bash
# Recover a stressed 216labs droplet: disk prune, pull main, restart edge + revenue apps.
# Usage: ./scripts/droplet-recover.sh [user@host]
# Heartbeats: run this before feature work when edge-smoke fails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"
SSH_OPTS=(-o ConnectTimeout=25 -o ServerAliveInterval=8 -o ServerAliveCountMax=4 -o BatchMode=yes)

ssh_retry() {
  local i max="${1:-6}"
  shift
  for ((i = 1; i <= max; i++)); do
    if ssh "${SSH_OPTS[@]}" "$REMOTE" "$@"; then
      return 0
    fi
    echo "SSH attempt $i/$max failed; retrying in 8s..." >&2
    sleep 8
  done
  return 1
}

if ! ssh_retry 6 'echo ok' | grep -q ok; then
  echo "SSH to $REMOTE failed after retries (banner hang = disk/OOM)." >&2
  echo "Next: ./scripts/droplet-reboot.sh  (needs DIGITALOCEAN_ACCESS_TOKEN)" >&2
  echo "   or DO dashboard → Power → Reboot 46.101.88.197, wait 2 min, re-run this script." >&2
  echo "See docs/DROPLET-RECOVERY.md" >&2
  exit 1
fi

echo "=== Disk before prune ==="
ssh_retry 3 'df -h / | tail -1'

echo "=== Prune (GHCR duplicates + dangling images) ==="
"$ROOT/scripts/prune-droplet-docker.sh" "$REMOTE" || true

# Extra prune when root FS is tight (docker ps can hang when disk is full).
ssh_retry 2 'bash -s' <<'REMOTE_PRUNE'
set -euo pipefail
TO="/usr/bin/timeout"
cd /opt/216labs
if [[ -f scripts/lib/prune-ghcr-duplicate-tags.sh ]]; then
  # shellcheck source=/dev/null
  source scripts/lib/prune-ghcr-duplicate-tags.sh
  prune_ghcr_duplicate_tags || true
fi
usepct="$(df / | tail -1 | awk "{print \$5}" | tr -d "%")"
if [[ "${usepct:-0}" -ge 88 ]]; then
  echo "Disk ${usepct}% — aggressive docker prune"
  $TO 180 docker system prune -af 2>&1 | tail -8 || true
fi
df -h / | tail -1
REMOTE_PRUNE

echo "=== Compose up (edge + revenue + cron) ==="
ssh_retry 2 'bash -s' <<'REMOTE_UP'
set -euo pipefail
TO="/usr/bin/timeout"
cd /opt/216labs
git pull -q
$TO 300 docker compose up -d caddy activator admin landing maxlearn storybook 1pageresearch cron-runner
$TO 120 docker compose up -d --force-recreate activator
$TO 30 docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>&1 | tail -2 || docker compose restart caddy
$TO 45 docker compose ps caddy activator admin landing maxlearn storybook 1pageresearch cron-runner
REMOTE_UP

echo
echo "=== Edge smoke (from laptop) ==="
if "$ROOT/scripts/edge-smoke.sh"; then
  echo "Lights on: edge-smoke passed."
else
  echo "WARN: edge-smoke still failing — try DO power cycle, then re-run this script." >&2
  exit 1
fi

"$ROOT/scripts/check-revenue-env-http.sh" || true
