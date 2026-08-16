#!/usr/bin/env bash
# Stop compose services whose apps.deploy_enabled is 0, except the activator
# protected/spine list. Disabled leftovers (restart: unless-stopped) fill the
# LRU cap so a host that actually had humans cannot cold-start.
#
# Reads sqlite via cron-runner (do not sqlite3 216labs.db from the host).
# Usage: SYNC_PROJECT_ROOT=/opt/216labs ./scripts/stop-disabled-compose-apps.sh
set -euo pipefail

ROOT="${SYNC_PROJECT_ROOT:-/opt/216labs}"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  [ -f .env.admin ] && . ./.env.admin
  set +a
fi

COMPOSE=(docker compose --env-file .env)
[ -f .env.admin ] && COMPOSE+=(--env-file .env.admin)

PROT_RAW="${ACTIVATOR_PROTECTED_SERVICES:-caddy,activator,admin,landing,cron-runner,storybook,maxlearn,1pageresearch,kidgift,anchor-api,zurichrunclubs}"

is_protected() {
  local lower
  lower=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  IFS=',' read -ra _P <<< "$PROT_RAW"
  for e in "${_P[@]}"; do
    e=$(echo "$e" | sed 's/#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')
    [ -z "$e" ] && continue
    [ "$e" = "$lower" ] && return 0
  done
  return 1
}

CRON_CTR=$("${COMPOSE[@]}" ps --status running --format '{{.Name}}' 2>/dev/null | grep -E 'cron-runner' | head -1 || true)
if [ -z "${CRON_CTR:-}" ]; then
  echo "WARN: stop-disabled: cron-runner not running — skip" >&2
  exit 0
fi

DISABLED=$(\
  docker exec "$CRON_CTR" node -e "
const Database = require('better-sqlite3');
const db = new Database(process.env.DATABASE_PATH || '/app/216labs.db');
const rows = db.prepare(
  \"SELECT docker_service FROM apps WHERE deploy_enabled = 0 AND docker_service IS NOT NULL AND trim(docker_service) != ''\"
).all();
for (const r of rows) process.stdout.write(String(r.docker_service) + '\\n');
" 2>/dev/null || true
)

if [ -z "${DISABLED:-}" ]; then
  echo "==> stop-disabled: no deploy_enabled=0 rows"
  exit 0
fi

RUNNING=$("${COMPOSE[@]}" ps --status running --services 2>/dev/null || true)
stopped=0
while IFS= read -r svc; do
  [ -z "${svc:-}" ] && continue
  if is_protected "$svc"; then
    continue
  fi
  if ! echo "$RUNNING" | grep -qx "$svc"; then
    continue
  fi
  echo "==> stop-disabled: stopping $svc (deploy_enabled=0, not spine)"
  "${COMPOSE[@]}" stop -t 15 "$svc" || true
  stopped=$((stopped + 1))
done <<< "$DISABLED"

echo "==> stop-disabled: stopped ${stopped} leftover(s)"
exit 0
