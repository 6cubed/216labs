#!/usr/bin/env bash
# Free disk on the droplet: dangling layers + duplicate ghcr.io/6cubed/216labs/* when 216labs/* exists.
# Usage: ./scripts/prune-droplet-docker.sh [user@host]
# Safe while containers use 216labs/<app>:latest (compose default after deploy retag).
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"

ssh -o ConnectTimeout=20 -o BatchMode=yes "$REMOTE" 'set -euo pipefail
echo "=== Before ==="
df -h / | tail -1
docker system df 2>/dev/null || true
docker image prune -f 2>/dev/null || true
removed=0
while IFS= read -r img; do
  [[ -z "$img" ]] && continue
  short="216labs/${img#ghcr.io/6cubed/216labs/}"
  if docker image inspect "$short" >/dev/null 2>&1; then
    if docker rmi "$img" >/dev/null 2>&1; then
      echo "  removed duplicate $img"
      removed=$((removed + 1))
    fi
  fi
done < <(docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep "^ghcr.io/6cubed/216labs/" || true)
docker volume prune -f 2>/dev/null || true
echo "=== After ($removed ghcr duplicates removed) ==="
df -h / | tail -1
docker system df 2>/dev/null || true
'
