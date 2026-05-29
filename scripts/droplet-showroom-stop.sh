#!/usr/bin/env bash
# Stop evictable demo containers when disk is tight — keeps spine + revenue hot pool only.
# Safe to run during recovery: cold apps still start via activator + GHCR.
# Usage: ./scripts/droplet-showroom-stop.sh [user@host]
# Env: RECOVER_HOT_SERVICES (space-separated), RECOVER_SHOWROOM_DISK_PCT (default 88)
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"
SSH_OPTS=(-o ConnectTimeout=25 -o BatchMode=yes -o ServerAliveInterval=8 -o ServerAliveCountMax=4)

ssh "${SSH_OPTS[@]}" "$REMOTE" 'bash -s' <<'REMOTE'
set -euo pipefail
TO="/usr/bin/timeout"
cd /opt/216labs

HOT="${RECOVER_HOT_SERVICES:-caddy activator admin landing maxlearn storybook 1pageresearch kidgift cron-runner}"
MIN_PCT="${RECOVER_SHOWROOM_DISK_PCT:-88}"

usepct="$(df / | tail -1 | awk "{print \$5}" | tr -d "%")"
if [[ "${usepct:-0}" -lt "$MIN_PCT" ]]; then
  echo "Disk ${usepct}% — below ${MIN_PCT}% showroom stop threshold; skipping"
  exit 0
fi

echo "Disk ${usepct}% — stopping compose services outside hot pool: $HOT"
before="$($TO 60 docker ps -q 2>/dev/null | wc -l | tr -d " ")"
stopped=0

for svc in $($TO 120 docker compose config --services 2>/dev/null || true); do
  if [[ " $HOT " == *" $svc "* ]]; then
    continue
  fi
  if $TO 45 docker compose stop -t 8 "$svc" 2>/dev/null; then
    echo "  stopped $svc"
    stopped=$((stopped + 1))
  fi
done

after="$($TO 60 docker ps -q 2>/dev/null | wc -l | tr -d " ")"
echo "Showroom stop: ${stopped} service(s); containers ${before} → ${after}"
df -h / | tail -1
REMOTE
