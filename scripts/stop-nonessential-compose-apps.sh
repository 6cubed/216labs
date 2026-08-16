#!/usr/bin/env bash
# Stop running compose services that are not spine and not human-visited.
# Bot-woken deploy_enabled=1 apps (pocket, aiart, …) fill ACTIVATOR_MAX_CONCURRENT_APPS
# so LRU can evict Anchor / Zurich Run Clubs. Disabled leftovers are handled by
# stop-disabled-compose-apps.sh; this catches enabled-but-unneeded containers.
#
# Usage: SYNC_PROJECT_ROOT=/opt/216labs ./scripts/stop-nonessential-compose-apps.sh
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

KEEP_RAW="${ACTIVATOR_PROTECTED_SERVICES:-caddy,activator,admin,landing,cron-runner,storybook,maxlearn,1pageresearch,kidgift,anchor-api,zurichrunclubs}"

is_keep() {
  local lower
  lower=$(echo "$1" | tr '[:upper:]' '[:lower:]')
  IFS=',' read -ra _K <<< "$KEEP_RAW"
  for e in "${_K[@]}"; do
    e=$(echo "$e" | sed 's/#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')
    [ -z "$e" ] && continue
    [ "$e" = "$lower" ] && return 0
  done
  return 1
}

RUNNING=$("${COMPOSE[@]}" ps --status running --services 2>/dev/null || true)
stopped=0
while IFS= read -r svc; do
  [ -z "${svc:-}" ] && continue
  if is_keep "$svc"; then
    continue
  fi
  echo "==> stop-nonessential: stopping $svc (not spine / not human-visited)"
  "${COMPOSE[@]}" stop -t 15 "$svc" || true
  stopped=$((stopped + 1))
done <<< "$RUNNING"

echo "==> stop-nonessential: stopped ${stopped} leftover(s)"
exit 0
