#!/usr/bin/env bash
# Ensure workflow spine services are running: admin (DB/API), activator, caddy.
# Pulls GHCR images and recreates with --no-build — never docker compose build on the VPS.
#
# Usage: SYNC_PROJECT_ROOT=/opt/216labs ./scripts/droplet-ensure-spine.sh

set -euo pipefail

ROOT="${SYNC_PROJECT_ROOT:-/opt/216labs}"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "ERROR: $ROOT/.env missing" >&2
  exit 1
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
COMPOSE=(docker compose --env-file .env)
[ -f .env.admin ] && COMPOSE+=(--env-file .env.admin)

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

is_running() {
  local svc="$1"
  "${COMPOSE[@]}" ps --status running --format '{{.Service}}' 2>/dev/null | grep -qx "$svc"
}

ensure_ghcr_service() {
  local svc="$1"
  if is_running "$svc"; then
    return 0
  fi
  echo "==> spine: $svc not running — pull GHCR and start (--no-build)"
  if ! pull_and_tag "$svc"; then
    echo "WARN: spine: pull failed for $svc" >&2
    return 1
  fi
  COMPOSE_DOCKER_CLI_BUILD=0 DOCKER_BUILDKIT=0 \
    "${COMPOSE[@]}" up -d --pull never --no-build --force-recreate "$svc"
}

ensure_ghcr_service admin
ensure_ghcr_service activator

if ! is_running caddy; then
  echo "==> spine: caddy not running — starting"
  COMPOSE_DOCKER_CLI_BUILD=0 DOCKER_BUILDKIT=0 \
    "${COMPOSE[@]}" up -d --pull never --no-build caddy
fi

# Revenue + marketing root (no GHCR pull here — keep running for edge smoke / checkout probes).
for svc in landing storybook maxlearn 1pageresearch cron-runner; do
  if is_running "$svc"; then
    continue
  fi
  echo "==> spine: $svc not running — compose up (--no-build)"
  COMPOSE_DOCKER_CLI_BUILD=0 DOCKER_BUILDKIT=0 \
    "${COMPOSE[@]}" up -d --pull never --no-build "$svc" 2>/dev/null || true
done

if [ -f "$ROOT/scripts/generate-caddyfile.py" ] && command -v python3 &>/dev/null; then
  python3 "$ROOT/scripts/generate-caddyfile.py" 2>&1 | tail -1 || true
  if is_running caddy; then
    "${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>&1 | tail -1 \
      || "${COMPOSE[@]}" restart caddy
  fi
fi

echo "==> droplet-ensure-spine: ok"
