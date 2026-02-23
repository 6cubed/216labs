#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh user@host
#
# Reads deploy-config.json to decide which apps to build/transfer.
# Toggle apps on/off via the 216labs_admin dashboard or by editing
# deploy-config.json directly.
#
# Only changed images are transferred (digest comparison).

REMOTE="${1:-${DEPLOY_HOST:-}}"
REPO="git@github.com:6cubed/216labs.git"
APP_DIR="/opt/216labs"
CONFIG_FILE="deploy-config.json"

if [ -z "$REMOTE" ]; then
  echo "Usage: ./deploy.sh user@droplet-ip"
  exit 1
fi

# ── Read deploy config ────────────────────────────────────────
declare -A ALL_SERVICES=(
  [ramblingradio]="./RamblingRadio"
  [stroll]="./Stroll.live"
  [onefit]="./onefit"
  [paperframe-frontend]="./paperframe/frontend"
  [hivefind]="./hivefind"
  [pipesecure]="./pipesecure"
  [pipesecure-worker]="./pipesecure:Dockerfile.worker"
  [admin]="./216labs_admin"
)

declare -A SERVICE_DEPS=(
  [pipesecure]="redis pipesecure-worker pipesecure-migrate"
)

if [ -f "$CONFIG_FILE" ]; then
  ENABLED_APPS=$(node -e "
    const c = JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));
    console.log(Object.entries(c.apps).filter(([,v])=>v.enabled).map(([k])=>k).join(' '));
  ")
  echo "==> Deploy config: $ENABLED_APPS"
else
  echo "==> No $CONFIG_FILE found, deploying all apps"
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
  echo "ERROR: No apps enabled in $CONFIG_FILE"
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

# Only start enabled services (stops anything no longer enabled)
# shellcheck disable=SC2086
docker compose up -d --remove-orphans $COMPOSE_SERVICES
docker compose ps
echo "==> Done."
REMOTE_SCRIPT
