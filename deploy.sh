#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh user@host
#
# Reads 216labs.db (SQLite) to decide which apps to build/transfer.
# Toggle apps on/off via the admin dashboard at :8007.
# After deploy, records image sizes and startup times back to the DB.

REMOTE="${1:-${DEPLOY_HOST:-}}"
REPO="git@github.com:6cubed/216labs.git"
APP_DIR="/opt/216labs"
DB_FILE="216labs.db"

if [ -z "$REMOTE" ]; then
  echo "Usage: ./deploy.sh user@droplet-ip"
  exit 1
fi

# ── Read deploy config from SQLite ────────────────────────────
declare -A ALL_SERVICES=(
  [ramblingradio]="./RamblingRadio"
  [stroll]="./Stroll.live"
  [onefit]="./onefit"
  [paperframe-frontend]="./paperframe/frontend"
  [hivefind]="./hivefind"
  [pipesecure]="./pipesecure"
  [pipesecure-worker]="./pipesecure:Dockerfile.worker"
  [admin]="./216labs_admin"
  [agimemes]="./agimemes.com"
)

declare -A SERVICE_DEPS=(
  [pipesecure]="redis pipesecure-worker pipesecure-migrate"
)

if [ -f "$DB_FILE" ]; then
  ENABLED_APPS=$(sqlite3 "$DB_FILE" "SELECT id FROM apps WHERE deploy_enabled = 1" | tr '\n' ' ')
  echo "==> Deploy config (from DB): $ENABLED_APPS"
else
  echo "==> No $DB_FILE found, deploying all apps"
  ENABLED_APPS="${!ALL_SERVICES[*]}"
fi

# ── Filter to enabled services ────────────────────────────────
SERVICES=()
for app in $ENABLED_APPS; do
  if [ -n "${ALL_SERVICES[$app]:-}" ]; then
    SERVICES+=("$app:${ALL_SERVICES[$app]}")
  fi
done

if [ ${#SERVICES[@]} -eq 0 ]; then
  echo "ERROR: No apps enabled"
  exit 1
fi

# ── Build locally ──────────────────────────────────────────────
echo "==> Building ${#SERVICES[@]} images locally..."
IMAGES=()
for svc in "${SERVICES[@]}"; do
  IFS=: read -r NAME CTX DFILE <<< "$svc"
  TAG="216labs/$NAME:latest"
  BUILD_ARGS=(-q -t "$TAG")
  if [ -n "${DFILE:-}" ]; then
    BUILD_ARGS+=(-f "$CTX/$DFILE")
  fi
  BUILD_ARGS+=("$CTX")
  echo "  [$NAME] building..."
  docker build "${BUILD_ARGS[@]}"
  IMAGES+=("$TAG")
done

# ── Record image sizes to DB ──────────────────────────────────
if [ -f "$DB_FILE" ]; then
  echo "==> Recording image sizes..."
  for TAG in "${IMAGES[@]}"; do
    SIZE_BYTES=$(docker image inspect --format '{{.Size}}' "$TAG" 2>/dev/null || echo 0)
    SIZE_MB=$(echo "scale=0; $SIZE_BYTES / 1048576" | bc)
    sqlite3 "$DB_FILE" "UPDATE apps SET image_size_mb = $SIZE_MB WHERE docker_image = '$TAG';" 2>/dev/null || true
    echo "  $TAG → ${SIZE_MB} MB"
  done
fi

# ── Incremental transfer (only changed images) ────────────────
echo "==> Checking which images changed..."
REMOTE_DIGESTS=$(ssh "$REMOTE" 'for img in '"$(printf '%s ' "${IMAGES[@]}")"'; do
  id=$(docker image inspect --format "{{.Id}}" "$img" 2>/dev/null || echo "missing")
  echo "$img=$id"
done')

CHANGED_IMAGES=()
for TAG in "${IMAGES[@]}"; do
  LOCAL_ID=$(docker image inspect --format "{{.Id}}" "$TAG" 2>/dev/null || echo "local-missing")
  REMOTE_ID=$(echo "$REMOTE_DIGESTS" | grep "^$TAG=" | cut -d= -f2)
  if [ "$LOCAL_ID" != "$REMOTE_ID" ]; then
    CHANGED_IMAGES+=("$TAG")
    echo "  [changed] $TAG"
  else
    echo "  [skip]    $TAG (unchanged)"
  fi
done

if [ ${#CHANGED_IMAGES[@]} -eq 0 ]; then
  echo "==> All images up to date, skipping transfer"
else
  echo "==> Transferring ${#CHANGED_IMAGES[@]}/${#IMAGES[@]} images to $REMOTE..."
  docker save "${CHANGED_IMAGES[@]}" | gzip | ssh "$REMOTE" 'docker load'
fi

# ── Determine which compose services to start ─────────────────
COMPOSE_SERVICES="caddy postgres"
for app in $ENABLED_APPS; do
  COMPOSE_SERVICES="$COMPOSE_SERVICES $app"
  if [ -n "${SERVICE_DEPS[$app]:-}" ]; then
    COMPOSE_SERVICES="$COMPOSE_SERVICES ${SERVICE_DEPS[$app]}"
  fi
done

# ── Start on droplet ──────────────────────────────────────────
echo "==> Starting stack on $REMOTE..."
echo "    Services: $COMPOSE_SERVICES"
ssh "$REMOTE" bash -s "$REPO" "$APP_DIR" "$COMPOSE_SERVICES" <<'REMOTE_SCRIPT'
set -euo pipefail
REPO="$1"
APP_DIR="$2"
COMPOSE_SERVICES="$3"

if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO" "$APP_DIR"
fi

cd "$APP_DIR"
git pull --ff-only 2>/dev/null || true

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "=========================================="
  echo "  Edit .env then re-run deploy.sh:"
  echo "    nano $APP_DIR/.env"
  echo "=========================================="
  exit 0
fi

# shellcheck disable=SC2086
docker compose up -d --remove-orphans $COMPOSE_SERVICES
docker compose ps
echo "==> Done."
REMOTE_SCRIPT

# ── Collect startup times from container logs ─────────────────
if [ -f "$DB_FILE" ]; then
  echo "==> Collecting startup times..."
  sleep 3

  STARTUP_DATA=$(ssh "$REMOTE" 'cd /opt/216labs && for svc in '"$COMPOSE_SERVICES"'; do
    MS=$(docker compose logs --tail 20 "$svc" 2>/dev/null | grep -oE "Ready in [0-9]+" | grep -oE "[0-9]+" | tail -1)
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

  echo "==> Metadata saved to $DB_FILE"
fi
