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

echo "=== Disk ==="
DISK_LINE="$(ssh_retry 3 'df -P / | awk "NR==2 {print}"' || true)"
echo "${DISK_LINE:-<unreadable>}"
usepct="$(printf '%s\n' "$DISK_LINE" | awk '{gsub(/%/,"",$5); print $5}')"

# docker system df / GHCR tag prune on 1GB RAM often kills sshd. Only prune when disk is the wedge.
if [[ "${usepct:-0}" -ge 88 ]]; then
  echo "=== Prune (disk ${usepct}% ≥88%) ==="
  "$ROOT/scripts/prune-droplet-docker.sh" "$REMOTE" || true
  ssh_retry 2 'bash -s' <<'REMOTE_PRUNE' || true
set -euo pipefail
TO="/usr/bin/timeout"
cd /opt/216labs
usepct="$(df / | tail -1 | awk "{print \$5}" | tr -d "%")"
if [[ "${usepct:-0}" -ge 88 ]]; then
  echo "Disk ${usepct}% — aggressive docker prune"
  $TO 180 docker system prune -af 2>&1 | tail -8 || true
fi
df -h / | tail -1
REMOTE_PRUNE
else
  echo "=== Skip prune (disk ${usepct:-?}% < 88%) — prune after reboot wedges sshd ==="
fi

echo "=== Showroom stop (disk ≥88%: drop demo containers, keep spine + revenue) ==="
"$ROOT/scripts/droplet-showroom-stop.sh" "$REMOTE" || true

# Prune/docker load often resets sshd briefly — wait before compose up.
echo "=== Cooldown after prune (20s) ==="
sleep 20

echo "=== Compose up (edge + revenue + cron) ==="
ssh_retry 8 'bash -s' <<'REMOTE_UP'
set -euo pipefail
TO="/usr/bin/timeout"
cd /opt/216labs
git pull -q
if [[ -f scripts/generate-caddyfile.py ]]; then
  $TO 120 python3 scripts/generate-caddyfile.py 2>&1 | tail -2 || true
fi
$TO 300 docker compose up -d caddy activator admin landing maxlearn storybook 1pageresearch kidgift cron-runner
$TO 120 docker compose up -d --force-recreate activator
$TO 90 docker compose up -d --no-deps --force-recreate caddy
$TO 45 docker compose ps caddy activator admin landing maxlearn storybook 1pageresearch kidgift cron-runner
if [[ -f scripts/stop-disabled-compose-apps.sh ]]; then
  SYNC_PROJECT_ROOT=/opt/216labs bash scripts/stop-disabled-compose-apps.sh || true
fi
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
