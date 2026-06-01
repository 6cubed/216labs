#!/usr/bin/env bash
# Free disk on the droplet: dangling layers + duplicate ghcr.io/6cubed/216labs/* when 216labs/* exists.
# Usage: ./scripts/prune-droplet-docker.sh [user@host]
# Safe while containers use 216labs/<app>:latest (compose default after deploy retag).
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"

ssh -o ConnectTimeout=20 -o BatchMode=yes "$REMOTE" "set -euo pipefail
echo '=== Before ==='
df -h / | tail -1
docker system df 2>/dev/null || true
. /opt/216labs/scripts/lib/prune-ghcr-duplicate-tags.sh
prune_ghcr_duplicate_tags || true
docker volume prune -f 2>/dev/null || true
usepct=\$(df / | tail -1 | awk '{print \$5}' | tr -d '%')
if [[ \"\${usepct:-0}\" -ge 88 ]]; then
  echo '=== Aggressive prune (disk ≥88%) ==='
  timeout 180 docker system prune -af 2>&1 | tail -12 || true
fi
echo '=== After ==='
df -h / | tail -1
docker system df 2>/dev/null || true
"
