#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh user@host
#
# Builds images locally, transfers them to the droplet over SSH,
# and starts the stack. No registry needed.

REMOTE="${1:-${DEPLOY_HOST:-}}"
REPO="git@github.com:6cubed/216labs.git"
APP_DIR="/opt/216labs"

if [ -z "$REMOTE" ]; then
  echo "Usage: ./deploy.sh user@droplet-ip"
  exit 1
fi

# Format: "image-name:context-dir[:Dockerfile]"
SERVICES=(
  "ramblingradio:./RamblingRadio"
  "stroll:./Stroll.live"
  "onefit:./onefit"
  "paperframe-frontend:./paperframe/frontend"
  "hivefind:./hivefind"
  "pipesecure:./pipesecure"
  "pipesecure-worker:./pipesecure:Dockerfile.worker"
  "admin:./216labs_admin"
)

# ── Build locally ──────────────────────────────────────────────
echo "==> Building images locally..."
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

# ── Transfer to droplet ───────────────────────────────────────
echo "==> Transferring images to $REMOTE (compressed)..."
docker save "${IMAGES[@]}" | gzip | ssh "$REMOTE" 'docker load'

# ── Start on droplet ──────────────────────────────────────────
echo "==> Starting stack on $REMOTE..."
ssh "$REMOTE" bash -s "$REPO" "$APP_DIR" <<'REMOTE_SCRIPT'
set -euo pipefail
REPO="$1"
APP_DIR="$2"

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

docker compose up -d --remove-orphans
docker compose ps
echo "==> Done."
REMOTE_SCRIPT
