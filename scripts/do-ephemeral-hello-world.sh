#!/usr/bin/env bash
# Create a tiny DigitalOcean droplet, serve hello world, then destroy it.
#
# Safety:
# - Requires `doctl` already authenticated (no token prompts here).
# - Always attempts to destroy the droplet on exit (trap).
#
# Usage:
#   ./scripts/do-ephemeral-hello-world.sh
#   DO_REGION=fra1 DO_SIZE=s-1vcpu-1gb ./scripts/do-ephemeral-hello-world.sh
#
# Output:
# - Prints droplet name + IP
# - Verifies HTTP 200
set -euo pipefail

if ! command -v doctl >/dev/null 2>&1; then
  echo "ERROR: doctl not found. Install: https://docs.digitalocean.com/reference/doctl/" >&2
  exit 1
fi

if ! doctl account get >/dev/null 2>&1; then
  echo "ERROR: doctl not authenticated. Run: doctl auth init" >&2
  exit 1
fi

REGION="${DO_REGION:-fra1}"
SIZE="${DO_SIZE:-s-1vcpu-1gb}"
IMAGE="${DO_IMAGE:-ubuntu-24-04-x64}"
TTL_MIN="${DO_TTL_MINUTES:-20}"

STAMP="$(date -u +%Y%m%d%H%M%S)"
NAME="${DO_NAME:-ephemeral-hello-${STAMP}}"
TAG="${DO_TAG:-ephemeral-hello}"

SSH_KEY_ID="${DO_SSH_KEY_ID:-}"
if [[ -z "$SSH_KEY_ID" ]]; then
  SSH_KEY_ID="$(doctl compute ssh-key list --format ID --no-header | head -1 || true)"
fi
if [[ -z "$SSH_KEY_ID" ]]; then
  echo "ERROR: No SSH keys in DigitalOcean account. Add one or set DO_SSH_KEY_ID." >&2
  exit 1
fi

cleanup() {
  echo "==> Destroying droplet (best-effort): $NAME"
  doctl compute droplet delete "$NAME" --force >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Creating droplet: $NAME ($REGION, $SIZE, $IMAGE)"
doctl compute droplet create "$NAME" \
  --region "$REGION" \
  --size "$SIZE" \
  --image "$IMAGE" \
  --ssh-keys "$SSH_KEY_ID" \
  --tag-names "$TAG" \
  --enable-monitoring \
  --user-data "#cloud-config
runcmd:
  - [ bash, -lc, 'apt-get update -y' ]
  - [ bash, -lc, 'DEBIAN_FRONTEND=noninteractive apt-get install -y nginx' ]
  - [ bash, -lc, 'printf \"%s\\n\" \"hello world (216labs)\" > /var/www/html/index.html' ]
  - [ bash, -lc, 'systemctl enable nginx && systemctl restart nginx' ]
" >/dev/null

echo "==> Waiting for IP..."
IP=""
for _ in $(seq 1 60); do
  IP="$(doctl compute droplet get "$NAME" --format PublicIPv4 --no-header 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ -n "$IP" && "$IP" != "<nil>" ]]; then break; fi
  sleep 2
done
if [[ -z "$IP" || "$IP" == "<nil>" ]]; then
  echo "ERROR: Could not get droplet IP" >&2
  exit 1
fi
echo "==> Droplet IP: $IP"

echo "==> Waiting for HTTP 200..."
OK="0"
for _ in $(seq 1 90); do
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 4 "http://${IP}/" 2>/dev/null || true)"
  if [[ "$code" == "200" ]]; then OK="1"; break; fi
  sleep 2
done

if [[ "$OK" != "1" ]]; then
  echo "ERROR: HTTP did not become 200 for http://${IP}/" >&2
  exit 1
fi

echo "==> OK: http://${IP}/ returned 200"
echo "==> Note: TTL target ${TTL_MIN} minutes; destroying now."

