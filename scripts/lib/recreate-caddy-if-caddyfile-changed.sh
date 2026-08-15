#!/usr/bin/env bash
# Generate Caddyfile; recreate the caddy container only if the file changed
# or caddy is not running. Periodic GHCR sync used to force-recreate Caddy
# every 20 minutes (edge_proxy / ECONNREFUSED on :80).
#
# Usage: SYNC_PROJECT_ROOT=/opt/216labs ./scripts/lib/recreate-caddy-if-caddyfile-changed.sh

set -euo pipefail
ROOT="${SYNC_PROJECT_ROOT:-/opt/216labs}"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "ERROR: $ROOT/.env missing" >&2
  exit 1
fi

CADDYFILE="${ROOT}/Caddyfile"

hash_file() {
  if [ -f "$1" ]; then
    sha256sum "$1" | awk '{print $1}'
  else
    echo "missing"
  fi
}

before="$(hash_file "$CADDYFILE")"
if [ -f "$ROOT/scripts/generate-caddyfile.py" ] && command -v python3 &>/dev/null; then
  python3 "$ROOT/scripts/generate-caddyfile.py" 2>&1 | tail -2 || true
fi
after="$(hash_file "$CADDYFILE")"

COMPOSE=(docker compose --env-file .env)
[ -f .env.admin ] && COMPOSE+=(--env-file .env.admin)

if ! "${COMPOSE[@]}" ps --status running --format '{{.Service}}' 2>/dev/null | grep -qx caddy; then
  echo "==> caddy: not running — start"
  COMPOSE_DOCKER_CLI_BUILD=0 DOCKER_BUILDKIT=0 \
    "${COMPOSE[@]}" up -d --no-deps --pull never --no-build caddy 2>&1 | tail -3 || true
  exit 0
fi

if [ "$before" = "$after" ]; then
  echo "==> caddy: Caddyfile unchanged — skip recreate"
  exit 0
fi

echo "==> caddy: Caddyfile changed — recreate"
"${COMPOSE[@]}" up -d --no-deps --force-recreate caddy 2>&1 | tail -3 || true
