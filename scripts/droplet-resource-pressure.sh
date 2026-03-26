#!/usr/bin/env bash
# Proactive disk / slot management on the VPS: prune dangling images, then LRU-stop
# evictable compose services (aligned with activator protected list) until free space
# and/or evictable running count are within limits.
#
# Usage: SYNC_PROJECT_ROOT=/opt/216labs ./scripts/droplet-resource-pressure.sh
# Env (optional; .env / .env.admin):
#   DROPLET_MIN_FREE_MB           — minimum free MB on / (default: 2048)
#   DROPLET_MAX_EVICTABLE_RUNNING — max concurrently running evictable app containers (default 10; 0 = no count cap, disk rule only)
#   ACTIVATOR_PROTECTED_SERVICES  — same comma list as activator
#   DROPLET_PRUNE_IMAGE_ON_EVICTION — 1 = docker rmi 216labs/<svc>:latest after stop
#   DROPLET_PRESSURE_MAX_STOPS    — max evictions per run (default: 30)
#   DROPLET_DB_PATH               — default 216labs.db

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

MIN_FREE_MB="${DROPLET_MIN_FREE_MB:-2048}"
# Align with activator LRU: trim evictable running count when disk is tight (0 = only free-space target).
MAX_EVICTABLE="${DROPLET_MAX_EVICTABLE_RUNNING:-10}"
PRUNE_IMG="${DROPLET_PRUNE_IMAGE_ON_EVICTION:-0}"
MAX_STOPS="${DROPLET_PRESSURE_MAX_STOPS:-30}"
PROT_RAW="${ACTIVATOR_PROTECTED_SERVICES:-caddy,activator,admin,landing,bugbounty,hello-nextjs,hello-flask}"
DB_FILE="${DROPLET_DB_PATH:-216labs.db}"

free_mb_root() {
  df -Pm / 2>/dev/null | awk 'NR==2 {print $4}'
}

is_protected() {
  local svc="$1"
  local lower
  lower=$(echo "$svc" | tr '[:upper:]' '[:lower:]')
  IFS=',' read -ra _P <<< "$PROT_RAW"
  for e in "${_P[@]}"; do
    e=$(echo "$e" | sed 's/#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')
    [ -z "$e" ] && continue
    [ "$e" = "$lower" ] && return 0
  done
  return 1
}

# Pick LRU evictable running service (oldest last_accessed_at first; empty = oldest).
pick_lru_victim() {
  if [ ! -f "$DB_FILE" ] || ! command -v sqlite3 &>/dev/null; then
    echo ""
    return
  fi
  local running_lines
  if ! running_lines=$(docker compose --env-file .env --env-file .env.admin ps --status running --services 2>/dev/null); then
    echo ""
    return
  fi
  while IFS= read -r svc; do
    [ -z "${svc:-}" ] && continue
    if is_protected "$svc"; then
      continue
    fi
    esc=${svc//\'/\'\'}
    la=$(sqlite3 "$DB_FILE" "SELECT COALESCE(last_accessed_at,'') FROM apps WHERE lower(docker_service) = lower('$esc') LIMIT 1;" 2>/dev/null || echo "")
    # Tab: sort key, then service name
    printf '%s\t%s\n' "$la" "$svc"
  done <<< "$(echo "$running_lines" | tr ' ' '\n' | grep -v '^$')" | sort -t$'\t' -k1,1 | head -1 | cut -f2 || true
}

count_evictable_running() {
  if [ ! -f "$DB_FILE" ] || ! command -v sqlite3 &>/dev/null; then
    echo "0"
    return
  fi
  local n=0
  local running_lines
  running_lines=$(docker compose --env-file .env --env-file .env.admin ps --status running --services 2>/dev/null || true)
  while IFS= read -r svc; do
    [ -z "${svc:-}" ] && continue
    if is_protected "$svc"; then
      continue
    fi
    esc=${svc//\'/\'\'}
    n=$((n + 1))
  done <<< "$(echo "$running_lines" | tr ' ' '\n' | grep -v '^$')"
  echo "$n"
}

mark_app_cold() {
  local docker_svc="$1"
  if [ ! -f "$DB_FILE" ] || ! command -v sqlite3 &>/dev/null; then
    return 0
  fi
  esc=${docker_svc//\'/\'\'}
  sqlite3 "$DB_FILE" "
    UPDATE apps SET runtime_status = 'cold',
      last_runtime_error = 'resource pressure eviction'
    WHERE lower(docker_service) = lower('$esc');
  " 2>/dev/null || true
}

evict_one() {
  local victim="$1"
  echo "==> pressure: stopping $victim (LRU / disk policy)"
  docker compose --env-file .env --env-file .env.admin stop -t 15 "$victim" 2>/dev/null || true
  mark_app_cold "$victim"
  if [ "$PRUNE_IMG" = "1" ] || [ "$PRUNE_IMG" = "true" ] || [ "$PRUNE_IMG" = "yes" ]; then
    docker rmi -f "216labs/${victim}:latest" 2>/dev/null || true
  fi
}

echo "==> droplet-resource-pressure: min_free=${MIN_FREE_MB}MB max_evictable=${MAX_EVICTABLE:-0}"

echo "==> pressure: docker image prune (dangling)"
docker image prune -f 2>/dev/null || true

FREE=$(free_mb_root || echo 0)
echo "==> pressure: free on / = ${FREE}MB"

stops=0
while [ "$stops" -lt "$MAX_STOPS" ]; do
  FREE=$(free_mb_root || echo 0)
  need_disk=0
  if [ "${FREE:-0}" -lt "$MIN_FREE_MB" ] 2>/dev/null; then
    need_disk=1
  fi

  evictable_count=$(count_evictable_running)
  need_cap=0
  if [ "${MAX_EVICTABLE:-0}" -gt 0 ] 2>/dev/null && [ "${evictable_count:-0}" -gt "$MAX_EVICTABLE" ] 2>/dev/null; then
    need_cap=1
  fi

  if [ "$need_disk" -eq 0 ] && [ "$need_cap" -eq 0 ]; then
    echo "==> droplet-resource-pressure: ok (free=${FREE}MB evictable_running=${evictable_count})"
    exit 0
  fi

  victim=$(pick_lru_victim)
  if [ -z "${victim:-}" ]; then
    echo "WARN: pressure: no evictable victim (add apps to DB or only protected running)" >&2
    docker image prune -f 2>/dev/null || true
    FREE=$(free_mb_root || echo 0)
    if [ "${FREE:-0}" -lt "$MIN_FREE_MB" ] 2>/dev/null; then
      echo "WARN: pressure: still low on disk (${FREE}MB < ${MIN_FREE_MB}MB)" >&2
    fi
    exit 0
  fi

  evict_one "$victim"
  stops=$((stops + 1))

  docker image prune -f 2>/dev/null || true
  FREE=$(free_mb_root || echo 0)
  echo "==> pressure: after stop free=${FREE}MB evictable~$(count_evictable_running)"
done

echo "WARN: pressure: hit DROPLET_PRESSURE_MAX_STOPS=$MAX_STOPS" >&2
exit 0
