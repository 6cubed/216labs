#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh user@host
#
# 216labs vibe-coding workflow: single source of truth (216labs.db) for what ships.
# Reads 216labs.db (SQLite) to decide which apps to build/transfer.
# 216labs.db holds app state and env_vars (secrets); it is never overwritten by
# this script. A timestamped backup is made on the server before each deploy.
# Toggle apps on/off via the admin dashboard at https://admin.agimemes.com
# After deploy, records image sizes and startup times back to the DB.

REMOTE="${1:-${DEPLOY_HOST:-}}"
REPO="git@github.com:6cubed/216labs.git"
APP_DIR="/opt/216labs"
DB_FILE="216labs.db"
DB_ENV_FILE="$(mktemp)"

cleanup() {
  rm -f "$DB_ENV_FILE"
}
trap cleanup EXIT

escape_env_value() {
  local value="$1"
  value="${value//$'\r'/}"
  value="${value//$'\n'/}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//\$/\\$}"
  printf '%s' "$value"
}

if [ -z "$REMOTE" ]; then
  echo "Usage: ./deploy.sh user@droplet-ip"
  exit 1
fi

SSH_OPTS=(
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=20
)

# ── Service mapping helpers ───────────────────────────────────
# Try manifest.json first; fall back to hardcoded cases for apps
# without manifests (anchor multi-service, pipesecure worker).

service_spec() {
  local result
  result=$(python3 scripts/app-lookup.py "$1" build_spec 2>/dev/null)
  if [ -n "$result" ]; then
    echo "$result"
    return
  fi
  # Fallback for apps without manifests
  case "$1" in
    anchor-api) echo "./apps/anchor/backend" ;;
    anchor-web) echo "./apps/anchor/frontend" ;;
    *) echo "" ;;
  esac
}

service_deps() {
  case "$1" in
    *) echo "" ;;
  esac
}

# Map app ID to docker-compose service name (where they differ).
# Reads from manifest docker_service field; falls back to the ID itself.
compose_svc_name() {
  local result
  result=$(python3 scripts/app-lookup.py "$1" docker_service 2>/dev/null)
  if [ -n "$result" ]; then
    echo "$result"
    return
  fi
  echo "$1"
}

# The server's admin container is the authoritative source for which apps are enabled.
# Fall back to the local DB (legacy), then to a hardcoded list.
ADMIN_CTR=$(ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "docker ps --filter name=216labs-admin-1 --format '{{.Names}}'" 2>/dev/null | head -1 || true)

if [ -n "$ADMIN_CTR" ]; then
  ENABLED_APPS=$(ssh "${SSH_OPTS[@]}" "$REMOTE" \
    "docker exec $ADMIN_CTR node -e \"
const db = require('better-sqlite3')('/app/216labs.db');
const rows = db.prepare(\\\"SELECT id FROM apps WHERE deploy_enabled = 1 OR id = 'admin' ORDER BY port\\\").all();
rows.forEach(r => process.stdout.write(r.id + ' '));
\"" 2>/dev/null | tr -s ' ')
  echo "==> Deploy config (from server DB): $ENABLED_APPS"
elif [ -f "$DB_FILE" ]; then
  ENABLED_APPS=$(sqlite3 "$DB_FILE" "SELECT id FROM apps WHERE deploy_enabled = 1 OR id = 'admin'" | tr '\n' ' ')
  echo "==> Deploy config (from local DB): $ENABLED_APPS"
else
  echo "==> No DB found, deploying all apps"
  ENABLED_APPS="ramblingradio stroll onefit hivefind admin agimemes agitshirts priors calibratedai bigleroys 1pageresearch artisinaleurope thezurichdatinggame oneroom"
fi

if [[ " $ENABLED_APPS " != *" admin "* ]]; then
  ENABLED_APPS="$ENABLED_APPS admin"
fi
# Force-include apps from config (scale: edit config file, not this script)
BOOTSTRAP_FILE="config/deploy-bootstrap.txt"
if [ -f "$BOOTSTRAP_FILE" ]; then
  while IFS= read -r force || [ -n "$force" ]; do
    force=$(echo "$force" | sed 's/#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//')
    [ -z "$force" ] && continue
    if [[ " $ENABLED_APPS " != *" $force "* ]]; then
      ENABLED_APPS="$ENABLED_APPS $force"
      echo "==> Force-including $force (from $BOOTSTRAP_FILE)"
    fi
  done < "$BOOTSTRAP_FILE"
else
  for force in happypath blog worldphoto offlinellm 1pageresearch facerate landing; do
    if [[ " $ENABLED_APPS " != *" $force "* ]]; then
      ENABLED_APPS="$ENABLED_APPS $force"
      echo "==> Force-including $force (not yet in server DB)"
    fi
  done
fi

# Cap total apps to avoid filling droplet disk (default 10). Set DEPLOY_MAX_APPS to override.
MAX_APPS="${DEPLOY_MAX_APPS:-10}"
# Priority order from config (scale: edit config/deploy-priority.txt, not this script)
PRIORITY_FILE="config/deploy-priority.txt"
if [ -f "$PRIORITY_FILE" ]; then
  DEPLOY_PRIORITY=""
  while IFS= read -r app || [ -n "$app" ]; do
    app=$(echo "$app" | sed 's/#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//')
    [ -z "$app" ] && continue
    DEPLOY_PRIORITY="$DEPLOY_PRIORITY $app"
  done < "$PRIORITY_FILE"
else
  DEPLOY_PRIORITY="admin landing blog pocket 1pageresearch facerate priors muinteoir happypath worldphoto offlinellm pipesecure ramblingradio stroll onefit hivefind agimemes agitshirts calibratedai bigleroys artisinaleurope thezurichdatinggame oneroom audioaicheckup storybook"
fi
CAPPED=""
for app in $DEPLOY_PRIORITY; do
  if [[ " $ENABLED_APPS " == *" $app "* ]]; then
    CAPPED="$CAPPED $app"
    count=$(echo "$CAPPED" | wc -w | tr -d ' ')
    [ "$count" -ge "$MAX_APPS" ] && break
  fi
done
if [ -n "$CAPPED" ]; then
  ENABLED_APPS=$(echo "$CAPPED" | tr -s ' ')
  echo "==> Capped to $MAX_APPS apps: $ENABLED_APPS"
fi

# ── Filter to enabled services ────────────────────────────────
SERVICES=()
for app in $ENABLED_APPS; do
  SPEC=$(service_spec "$app")
  if [ -n "$SPEC" ]; then
    SERVICES+=("$app:$SPEC")
  fi
done

if [ ${#SERVICES[@]} -eq 0 ]; then
  echo "ERROR: No apps enabled"
  exit 1
fi

# ── Source-change detection (git-based) ──────────────────────
# docker build always produces a new image ID (timestamps differ), so
# comparing local vs remote IDs always shows "changed". Instead we hash
# the last git commit touching each context dir plus any uncommitted diff.
HASH_FILE=".deploy-hashes"

get_context_hash() {
  local ctx="$1"
  local commit_hash diff_hash
  commit_hash=$(git log -1 --format="%H" -- "$ctx" 2>/dev/null || echo "unknown")
  diff_hash=$(git diff HEAD -- "$ctx" | git hash-object --stdin 2>/dev/null || echo "clean")
  echo "${commit_hash}:${diff_hash}"
}

echo "==> Checking for source changes..."
SERVICES_TO_BUILD=()
ALL_IMAGES=()
for svc in "${SERVICES[@]}"; do
  IFS=: read -r NAME CTX DFILE <<< "$svc"
  TAG="216labs/$NAME:latest"
  ALL_IMAGES+=("$TAG")
  CTX_HASH=$(get_context_hash "$CTX")
  STORED=$(grep "^$TAG=" "$HASH_FILE" 2>/dev/null | head -1 | sed 's/^[^=]*=//' || true)
  if [ "$CTX_HASH" = "$STORED" ] && docker image inspect "$TAG" &>/dev/null 2>&1; then
    echo "  [skip]  $NAME (source unchanged)"
  else
    echo "  [build] $NAME"
    SERVICES_TO_BUILD+=("$svc")
  fi
done

# ── Build locally (only changed) ──────────────────────────────
# BuildKit speeds up rebuilds via better layer caching (helps lightweight UI-only changes).
export DOCKER_BUILDKIT=1
BUILT_IMAGES=()
if [ ${#SERVICES_TO_BUILD[@]} -gt 0 ]; then
  echo "==> Building ${#SERVICES_TO_BUILD[@]}/${#ALL_IMAGES[@]} images locally..."
  for svc in "${SERVICES_TO_BUILD[@]}"; do
    IFS=: read -r NAME CTX DFILE <<< "$svc"
    TAG="216labs/$NAME:latest"
    BUILD_ARGS=(-q -t "$TAG")
    if [ -n "${DFILE:-}" ]; then
      BUILD_ARGS+=(-f "$CTX/$DFILE")
    fi
    BUILD_ARGS+=("$CTX")
    echo "  [$NAME] building..."
    docker build "${BUILD_ARGS[@]}"
    BUILT_IMAGES+=("$TAG")
  done
else
  echo "==> No source changes detected, skipping all builds"
fi

# ── Record image sizes to DB ──────────────────────────────────
if [ -f "$DB_FILE" ] && [ ${#BUILT_IMAGES[@]} -gt 0 ]; then
  echo "==> Recording image sizes..."
  for TAG in "${BUILT_IMAGES[@]}"; do
    SIZE_BYTES=$(docker image inspect --format '{{.Size}}' "$TAG" 2>/dev/null || echo 0)
    SIZE_MB=$(echo "scale=0; $SIZE_BYTES / 1048576" | bc)
    sqlite3 "$DB_FILE" "UPDATE apps SET image_size_mb = $SIZE_MB WHERE docker_image = '$TAG';" 2>/dev/null || true
    echo "  $TAG → ${SIZE_MB} MB"
  done
fi

# ── Transfer newly built images ───────────────────────────────
# Use zstd when available (faster than gzip). On server: apt install zstd.
if [ ${#BUILT_IMAGES[@]} -eq 0 ]; then
  echo "==> All images up to date, skipping transfer"
else
  # Free disk on server before transfer (prune unused containers and images)
  echo "==> Pruning unused Docker resources on server to free space..."
  ssh "${SSH_OPTS[@]}" "$REMOTE" 'docker container prune -f 2>/dev/null; docker image prune -af 2>/dev/null; echo "Prune done"' 2>/dev/null || true

  USE_ZSTD=false
  if command -v zstd &>/dev/null; then
    if ssh "${SSH_OPTS[@]}" "$REMOTE" 'command -v zstd &>/dev/null' 2>/dev/null; then
      USE_ZSTD=true
    fi
  fi
  if [ "$USE_ZSTD" = true ]; then
    echo "==> Transferring ${#BUILT_IMAGES[@]}/${#ALL_IMAGES[@]} images to $REMOTE (zstd)..."
    docker save "${BUILT_IMAGES[@]}" | zstd -3 -T0 | ssh "${SSH_OPTS[@]}" "$REMOTE" 'zstd -d | docker load'
  else
    echo "==> Transferring ${#BUILT_IMAGES[@]}/${#ALL_IMAGES[@]} images to $REMOTE..."
    docker save "${BUILT_IMAGES[@]}" | gzip | ssh "${SSH_OPTS[@]}" "$REMOTE" 'docker load'
  fi
  # Persist source hashes so next deploy can skip unchanged apps
  for svc in "${SERVICES_TO_BUILD[@]}"; do
    IFS=: read -r NAME CTX DFILE <<< "$svc"
    TAG="216labs/$NAME:latest"
    CTX_HASH=$(get_context_hash "$CTX")
    TMP=$(mktemp)
    { grep -v "^$TAG=" "$HASH_FILE" 2>/dev/null || true; echo "$TAG=$CTX_HASH"; } > "$TMP"
    mv "$TMP" "$HASH_FILE"
  done
fi

# ── Determine which compose services to start ─────────────────
COMPOSE_SERVICES="caddy"
for app in $ENABLED_APPS; do
  COMPOSE_SERVICES="$COMPOSE_SERVICES $(compose_svc_name "$app")"
  DEPS=$(service_deps "$app")
  if [ -n "$DEPS" ]; then
    COMPOSE_SERVICES="$COMPOSE_SERVICES $DEPS"
  fi
done

# Build a list of compose-service names for newly built images only.
# These are the only containers that need --force-recreate; everything else
# just needs to be "ensure running" which avoids the OOM spike of mass restart.
CHANGED_COMPOSE_SVCS=""
if [ ${#SERVICES_TO_BUILD[@]} -gt 0 ]; then
  for svc in "${SERVICES_TO_BUILD[@]}"; do
    IFS=: read -r NAME CTX DFILE <<< "$svc"
    CHANGED_COMPOSE_SVCS="$CHANGED_COMPOSE_SVCS $(compose_svc_name "$NAME")"
  done
fi
CHANGED_COMPOSE_SVCS="${CHANGED_COMPOSE_SVCS# }"  # trim leading space

# ── Start on droplet ──────────────────────────────────────────
echo "==> Starting stack on $REMOTE..."
echo "    All services: $COMPOSE_SERVICES"
echo "    Changed (will restart): ${CHANGED_COMPOSE_SVCS:-none}"
# Use __none__ sentinel so the empty string survives SSH argument passing
# (SSH joins args with spaces, collapsing empty strings and shifting positions).
CHANGED_ARG="${CHANGED_COMPOSE_SVCS:-__none__}"
# Pass changed-services sentinel as $3, then all services as individual args ($4+)
ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s "$REPO" "$APP_DIR" "$CHANGED_ARG" $COMPOSE_SERVICES <<'REMOTE_SCRIPT'
set -euo pipefail
REPO="$1"
APP_DIR="$2"
CHANGED_SERVICES="$3"   # "__none__" when nothing changed, else space-separated names
[ "$CHANGED_SERVICES" = "__none__" ] && CHANGED_SERVICES=""
shift 3
COMPOSE_SERVICES="$*"   # all services as individual args

if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"

# Backup admin DB before any deploy steps. Never overwrite or delete 216labs.db;
# env_vars and app state live here and must persist across deploys.
if [ -f 216labs.db ]; then
  cp -a 216labs.db "216labs.db.bak.$(date +%Y%m%d%H%M)"
  # Keep only the 5 most recent backups
  ls -t 216labs.db.bak.* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
fi

git pull --ff-only 2>/dev/null || true

# Stop compose services we are not deploying (saves memory and allows image prune to free disk)
for svc in $(docker compose config --services 2>/dev/null || true); do
  if [[ " $COMPOSE_SERVICES " != *" $svc "* ]]; then
    echo "==> Stopping unused service: $svc"
    docker compose --env-file .env --env-file .env.admin stop "$svc" 2>/dev/null || true
  fi
done

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "=========================================="
  echo "  Edit .env then re-run deploy.sh:"
  echo "    nano $APP_DIR/.env"
  echo "=========================================="
  exit 0
fi

# Write env vars from running admin container — the authoritative source.
ADMIN_CTR=$(docker ps --filter name=admin --format "{{.Names}}" 2>/dev/null | head -1 || true)
if [ -n "$ADMIN_CTR" ]; then
  docker exec "$ADMIN_CTR" node -e "
const db = require('better-sqlite3')('/app/216labs.db');
const rows = db.prepare(\"SELECT key, value FROM env_vars WHERE value IS NOT NULL AND value != ''\").all();
rows.forEach(r => process.stdout.write(r.key + '=' + r.value + '\n'));
" > .env.admin 2>/dev/null || : > .env.admin
  ENV_COUNT=$(wc -l < .env.admin | tr -d ' ')
  echo "==> Loaded ${ENV_COUNT} env vars from admin container"
else
  : > .env.admin
  echo "==> No admin container running yet, using .env defaults only"
fi

# Force Caddy to reload so it picks up Caddyfile changes (e.g. new app vhosts like blog).
echo "==> Reloading Caddy (pick up Caddyfile changes)..."
docker compose --env-file .env --env-file .env.admin up -d --no-build --force-recreate caddy 2>/dev/null || true

# Count currently running containers to decide startup strategy.
RUNNING=$(docker ps --filter 'label=com.docker.compose.project=216labs' --format '{{.Names}}' 2>/dev/null | wc -l | tr -d ' ')

if [ "${RUNNING:-0}" -lt 4 ]; then
  # Initial startup (fresh server / post-reboot with no containers).
  # Start in batches to avoid OOM on memory-constrained hosts.
  echo "==> Initial startup — bringing up services in batches to avoid OOM..."
  docker compose --env-file .env --env-file .env.admin up -d --remove-orphans --no-build caddy
  echo "==> Infrastructure up. Waiting 15s..."
  sleep 15

  batch="" count=0
  for svc in $COMPOSE_SERVICES; do
    case "$svc" in caddy) continue ;; esac
    batch="$batch $svc" ; count=$((count+1))
    if [ "$count" -ge 4 ]; then
      echo "==> Starting batch:$batch"
      # shellcheck disable=SC2086
      docker compose --env-file .env --env-file .env.admin up -d --no-build $batch
      echo "==> Waiting 25s..."
      sleep 25
      batch="" ; count=0
    fi
  done
  if [ -n "$(echo "$batch" | tr -d ' ')" ]; then
    echo "==> Starting final batch:$batch"
    # shellcheck disable=SC2086
    docker compose --env-file .env --env-file .env.admin up -d --no-build $batch
    sleep 10
  fi
else
  # Normal deploy — ensure all services are running, then only restart the ones
  # with new images. This avoids mass-restart OOM spikes.
  echo "==> Normal deploy — ensuring all services are up..."
  # shellcheck disable=SC2086
  docker compose --env-file .env --env-file .env.admin up -d --remove-orphans --no-build $COMPOSE_SERVICES

  if [ -n "$(echo "${CHANGED_SERVICES:-}" | tr -d ' ')" ]; then
    echo "==> Restarting changed services: $CHANGED_SERVICES"
    # shellcheck disable=SC2086
    docker compose --env-file .env --env-file .env.admin up -d --no-build --force-recreate $CHANGED_SERVICES
  fi
fi

docker compose ps

# Post-deploy: prune unused images to avoid filling disk (keeps images used by running containers).
echo "==> Pruning unused Docker images..."
docker image prune -a -f

echo "==> Done."
REMOTE_SCRIPT

# ── Collect startup times from container logs ─────────────────
if [ -f "$DB_FILE" ]; then
  echo "==> Collecting startup times..."
  sleep 3

  STARTUP_DATA=$(ssh "${SSH_OPTS[@]}" "$REMOTE" 'cd /opt/216labs && for svc in '"$COMPOSE_SERVICES"'; do
    MS=$(docker compose logs --no-follow --tail 20 "$svc" 2>/dev/null | grep -oE "Ready in [0-9]+" | grep -oE "[0-9]+" | tail -1)
    if [ -n "$MS" ]; then
      echo "$svc=$MS"
    fi
  done')

  NOW=$(date -u +"%Y-%m-%d")
  while IFS='=' read -r SVC MS; do
    [ -z "$SVC" ] && continue
    sqlite3 "$DB_FILE" "UPDATE apps SET startup_time_ms = $MS, last_deployed_at = '$NOW' WHERE docker_service = '$SVC';" 2>/dev/null || true
    echo "  $SVC → ${MS}ms startup"
  done <<< "$STARTUP_DATA"

  # Mark deploy time for all enabled apps
  for app in $ENABLED_APPS; do
    sqlite3 "$DB_FILE" "UPDATE apps SET last_deployed_at = '$NOW' WHERE id = '$app';" 2>/dev/null || true
  done

  # Update commit counts from git log for each service
  echo "==> Updating commit counts..."
  for svc in "${SERVICES[@]}"; do
    IFS=: read -r NAME CTX _DFILE <<< "$svc"
    GITPATH="${CTX#./}"
    COMMITS=$(git log --oneline -- "$GITPATH" 2>/dev/null | wc -l | xargs)
    if [ -n "$COMMITS" ] && [ "$COMMITS" -gt 0 ] 2>/dev/null; then
      sqlite3 "$DB_FILE" "UPDATE apps SET total_commits = $COMMITS WHERE id = '$NAME';" 2>/dev/null || true
      echo "  $NAME → $COMMITS commits"
    fi
  done

  echo "==> Metadata saved to $DB_FILE"
fi
