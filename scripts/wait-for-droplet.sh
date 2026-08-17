#!/usr/bin/env bash
# Poll SSH until the droplet answers, then run droplet-recover.sh.
# Usage: ./scripts/wait-for-droplet.sh [user@host]
# Env: WAIT_MAX_SEC (default 600), WAIT_INTERVAL_SEC (default 15)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"
MAX="${WAIT_MAX_SEC:-600}"
INTERVAL="${WAIT_INTERVAL_SEC:-15}"
SSH_OPTS=(-o ConnectTimeout=12 -o BatchMode=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=2)

elapsed=0
echo "Waiting for SSH on $REMOTE (max ${MAX}s, interval ${INTERVAL}s)..."

while [[ "$elapsed" -lt "$MAX" ]]; do
  if ssh "${SSH_OPTS[@]}" "$REMOTE" 'echo ok' 2>/dev/null | grep -q ok; then
    echo "SSH up after ${elapsed}s — settling 20s before recover (sshd still fragile)..."
    sleep 20
    exec "$ROOT/scripts/droplet-recover.sh" "$REMOTE"
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
  echo "  still down (${elapsed}s)..."
done

echo "SSH did not recover within ${MAX}s." >&2
echo "Reboot: DO dashboard → Power → Reboot, or DIGITALOCEAN_ACCESS_TOKEN=… ./scripts/droplet-reboot.sh" >&2
exit 1
