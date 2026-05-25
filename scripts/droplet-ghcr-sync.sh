#!/usr/bin/env bash
# Run on the droplet (cron/systemd) to pull latest GHCR images for *running* 216labs app services
# and recreate containers so active stack tracks CI without a full ./deploy.sh from a laptop.
#
# Usage: SYNC_PROJECT_ROOT=/opt/216labs ./scripts/droplet-ghcr-sync.sh
# Env:
#   SYNC_PROJECT_ROOT — default /opt/216labs
#   SYNC_EXCLUDE_SERVICES — comma-separated compose service names to never touch (default: caddy,activator)
#   SYNC_SERVICE — optional: only sync this compose service (must be running; case-insensitive)
#   SYNC_SKIP_IF_DISK_PCT_GE — skip image pulls when root use% >= this (default 90; 0 = disable)

set -euo pipefail

ROOT="${SYNC_PROJECT_ROOT:-/opt/216labs}"
# zurichrunclubs: GHCR :latest can lag CI; periodic pull was recreating containers with stale images over laptop deploys.
# Spine + revenue hot pool: periodic sync must not recreate these (use SYNC_SERVICE=admin explicitly).
EXCLUDE_RAW="${SYNC_EXCLUDE_SERVICES:-caddy,activator,admin,landing,cron-runner,storybook,maxlearn,1pageresearch,zurichrunclubs}"
SYNC_SERVICE_RAW="${SYNC_SERVICE:-}"
SYNC_SERVICE_LOWER=""
if [ -n "$SYNC_SERVICE_RAW" ]; then
  SYNC_SERVICE_LOWER=$(echo "$SYNC_SERVICE_RAW" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
fi

cd "$ROOT"

if [ ! -f .env ]; then
  echo "ERROR: $ROOT/.env missing" >&2
  exit 1
fi

# Free disk / enforce evictable cap before pulling layers (same SYNC_PROJECT_ROOT).
if [ -f "$ROOT/scripts/droplet-resource-pressure.sh" ]; then
  SYNC_PROJECT_ROOT="$ROOT" bash "$ROOT/scripts/droplet-resource-pressure.sh" || true
fi
if [ -f "$ROOT/scripts/droplet-ensure-spine.sh" ]; then
  SYNC_PROJECT_ROOT="$ROOT" bash "$ROOT/scripts/droplet-ensure-spine.sh" || true
fi

DISK_SKIP_GE="${SYNC_SKIP_IF_DISK_PCT_GE:-90}"
if [[ "$DISK_SKIP_GE" =~ ^[0-9]+$ ]] && [ "$DISK_SKIP_GE" -gt 0 ]; then
  ROOT_USE_PCT=$(df -P / 2>/dev/null | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
  if [[ "${ROOT_USE_PCT:-0}" =~ ^[0-9]+$ ]] && [ "$ROOT_USE_PCT" -ge "$DISK_SKIP_GE" ]; then
    echo "WARN: root ${ROOT_USE_PCT}% full (>= ${DISK_SKIP_GE}%) — skipping GHCR pulls to avoid deepening wedge" >&2
    echo "      Run droplet-resource-pressure.sh / droplet-recover.sh; set SYNC_SKIP_IF_DISK_PCT_GE=0 to force pull" >&2
    exit 0
  fi
fi

set -a
# shellcheck disable=SC1091
. ./.env
if [ -f .env.admin ]; then
  # shellcheck disable=SC1091
  . ./.env.admin
fi
set +a

if [ -f 216labs.db ] && command -v sqlite3 &>/dev/null; then
  _v=$(sqlite3 216labs.db "SELECT value FROM env_vars WHERE key='GHCR_TOKEN' AND value != '' LIMIT 1" 2>/dev/null || true)
  [ -n "${_v:-}" ] && GHCR_TOKEN="$_v"
  _v=$(sqlite3 216labs.db "SELECT value FROM env_vars WHERE key='GHCR_USERNAME' AND value != '' LIMIT 1" 2>/dev/null || true)
  [ -n "${_v:-}" ] && GHCR_USERNAME="$_v"
  _v=$(sqlite3 216labs.db "SELECT value FROM env_vars WHERE key='ACTIVATOR_REGISTRY_PREFIX' AND value != '' LIMIT 1" 2>/dev/null || true)
  [ -n "${_v:-}" ] && ACTIVATOR_REGISTRY_PREFIX="$_v"
fi

REG="${ACTIVATOR_REGISTRY_PREFIX:-ghcr.io/6cubed/216labs}"
REG="${REG%/}"

GHCR_LOGGED_IN=0

is_excluded() {
  local svc="$1"
  local lower
  lower=$(echo "$svc" | tr '[:upper:]' '[:lower:]')
  # Explicit SYNC_SERVICE=admin (etc.) overrides the periodic exclude list.
  if [ -n "$SYNC_SERVICE_LOWER" ] && [ "$lower" = "$SYNC_SERVICE_LOWER" ]; then
    return 1
  fi
  IFS=',' read -ra _EX <<< "$EXCLUDE_RAW"
  for e in "${_EX[@]}"; do
    e=$(echo "$e" | sed 's/#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')
    [ -z "$e" ] && continue
    [ "$e" = "$lower" ] && return 0
  done
  return 1
}

short_from_image() {
  local img="$1"
  if [[ "$img" =~ 216labs/([^:]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$img" =~ ghcr.io/[^/]+/216labs/([^:]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

ensure_ghcr_login() {
  if [ "$GHCR_LOGGED_IN" = "1" ]; then
    return 0
  fi
  if [ -z "${GHCR_TOKEN:-}" ] || [ -z "${GHCR_USERNAME:-}" ]; then
    return 1
  fi
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
  GHCR_LOGGED_IN=1
}

pull_and_tag() {
  local short="$1"
  local src="$REG/$short:latest"
  local local_tag="216labs/$short:latest"
  if docker pull "$src"; then
    docker tag "$src" "$local_tag"
    return 0
  fi
  if ensure_ghcr_login; then
    if docker pull "$src"; then
      docker tag "$src" "$local_tag"
      return 0
    fi
  fi
  return 1
}

PS_OUT=$(docker compose --env-file .env --env-file .env.admin ps --status running --format '{{.Service}}|{{.Image}}' 2>/dev/null || true)
while IFS='|' read -r svc img; do
  [ -z "${svc:-}" ] && continue
  [ -z "${img:-}" ] && continue
  if is_excluded "$svc"; then
    continue
  fi
  if ! short=$(short_from_image "$img"); then
    continue
  fi

  echo "==> GHCR sync: $svc ($REG/$short:latest -> 216labs/$short:latest)"
  if ! pull_and_tag "$short"; then
    echo "WARN: pull failed for $short — skip" >&2
    continue
  fi

  docker compose --env-file .env --env-file .env.admin up -d --pull never --no-build --force-recreate "$svc"
  MATCHED=1
  if [ -n "$SYNC_SERVICE_LOWER" ]; then
    break
  fi
done <<< "$PS_OUT"

if [ -n "$SYNC_SERVICE_LOWER" ] && [ "$MATCHED" != "1" ]; then
  echo "ERROR: SYNC_SERVICE=$SYNC_SERVICE_RAW — not running or not a 216labs/GHCR image (see: docker compose ps)" >&2
  exit 1
fi

# pull+tag leaves both ghcr.io/… and 216labs/… on disk; drop GHCR copy when local tag exists.
if [ -f "$ROOT/scripts/lib/prune-ghcr-duplicate-tags.sh" ]; then
  # shellcheck source=lib/prune-ghcr-duplicate-tags.sh
  . "$ROOT/scripts/lib/prune-ghcr-duplicate-tags.sh"
  prune_ghcr_duplicate_tags || true
fi

# Recreate of any app can leave Caddy on a stale config; regen + reload spine every sync.
if [ -f "$ROOT/scripts/generate-caddyfile.py" ] && command -v python3 &>/dev/null; then
  echo "==> GHCR sync: regenerate Caddyfile"
  python3 "$ROOT/scripts/generate-caddyfile.py" 2>&1 | tail -2 || true
fi
if docker compose --env-file .env --env-file .env.admin ps --status running --format '{{.Service}}' 2>/dev/null | grep -qx caddy; then
  docker compose --env-file .env --env-file .env.admin exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>&1 | tail -2 \
    || docker compose --env-file .env --env-file .env.admin restart caddy
fi
if [ -f "$ROOT/scripts/droplet-ensure-spine.sh" ]; then
  SYNC_PROJECT_ROOT="$ROOT" bash "$ROOT/scripts/droplet-ensure-spine.sh" || true
fi

echo "==> droplet-ghcr-sync done."
