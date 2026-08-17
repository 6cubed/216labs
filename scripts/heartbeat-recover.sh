#!/usr/bin/env bash
# Heartbeat recovery: edge smoke → SSH probe → droplet-recover when possible.
# Usage: ./scripts/heartbeat-recover.sh [user@host]
# Exit 0 = edge AND SSH OK, or recover succeeded; 1 = recover ran but smoke still bad; 2 = need DO reboot (including edge-up / sshd-down).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"
SSH_OPTS=(-o ConnectTimeout=12 -o BatchMode=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=2)

echo "=== Heartbeat recover ==="

edge_ok=0
if "$ROOT/scripts/edge-smoke.sh"; then
  edge_ok=1
fi

echo
"$ROOT/scripts/droplet-wedge-check.sh" "$REMOTE" || true

echo
if ssh "${SSH_OPTS[@]}" "$REMOTE" 'echo ok' 2>/dev/null | grep -q '^ok$'; then
  if [[ "$edge_ok" -eq 1 ]]; then
    echo "Edge OK and SSH up — no recovery needed."
    exit 0
  fi
  echo "SSH up — running droplet-recover..."
  if "$ROOT/scripts/droplet-recover.sh" "$REMOTE"; then
    echo "Recover finished."
    exit 0
  fi
  echo "Recover script failed." >&2
  exit 1
fi

echo
if [[ "$edge_ok" -eq 1 ]]; then
  echo "Edge up but SSH down (sshd refused or timed out) — not lights-on." >&2
else
  echo "SSH not usable — reboot the droplet first:" >&2
fi
echo "  https://cloud.digitalocean.com/droplets → 46.101.88.197 → Power → Reboot" >&2
echo "  Then: ./scripts/wait-for-droplet.sh $REMOTE" >&2
echo "  Or:   DIGITALOCEAN_ACCESS_TOKEN=… ./scripts/droplet-reboot.sh" >&2
exit 2
