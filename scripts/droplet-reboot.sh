#!/usr/bin/env bash
# Reboot the 216labs droplet via DigitalOcean API when SSH is wedged (disk 97%, banner hang).
# Usage: DIGITALOCEAN_ACCESS_TOKEN=<token> ./scripts/droplet-reboot.sh [droplet_ip]
# Then: sleep 120 && ./scripts/droplet-recover.sh
set -euo pipefail

IP="${1:-46.101.88.197}"
TOKEN="${DIGITALOCEAN_ACCESS_TOKEN:-${DOCTL_ACCESS_TOKEN:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "No DIGITALOCEAN_ACCESS_TOKEN — reboot from the DO dashboard:" >&2
  echo "  https://cloud.digitalocean.com/droplets → 216labs / $IP → Power → Reboot" >&2
  echo "Wait ~2 minutes, then: ./scripts/droplet-recover.sh" >&2
  exit 1
fi

if ! command -v doctl >/dev/null 2>&1; then
  echo "Install doctl: brew install doctl" >&2
  exit 1
fi

export DIGITALOCEAN_ACCESS_TOKEN="$TOKEN"
DROPLET_ID="$(doctl compute droplet list --format ID,PublicIPv4 --no-header | awk -v ip="$IP" '$2 == ip {print $1; exit}')"

if [[ -z "$DROPLET_ID" ]]; then
  echo "No droplet found with public IP $IP" >&2
  exit 1
fi

echo "Rebooting droplet id=$DROPLET_ID ($IP)..."
doctl compute droplet-action reboot "$DROPLET_ID" --wait
echo "Reboot complete. Waiting 90s for sshd..."
sleep 90
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT/scripts/droplet-recover.sh" "root@${IP}"
