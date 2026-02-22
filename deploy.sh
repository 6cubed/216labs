#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./deploy.sh [user@host]
#
# Builds images locally, pushes to GitHub Container Registry,
# then SSHs to the droplet to pull and run them.
# The droplet never builds anything — zero CPU pressure.
#
# Prerequisites:
#   Local:  docker, gh (GitHub CLI) or docker login ghcr.io
#   Remote: SSH access with key-based auth

REMOTE="${1:-${DEPLOY_HOST:-}}"
REGISTRY="ghcr.io/6cubed/216labs"
REPO="git@github.com:6cubed/216labs.git"
APP_DIR="/opt/216labs"

if [ -z "$REMOTE" ]; then
  echo "Usage: ./deploy.sh user@droplet-ip"
  echo "  or set DEPLOY_HOST=user@droplet-ip"
  exit 1
fi

# ── Build and push images locally ──────────────────────────────
echo "==> Building images locally..."

SERVICES=(
  "ramblingradio:./RamblingRadio"
  "stroll:./Stroll.live"
  "onefit:./onefit"
  "paperframe-frontend:./paperframe/frontend"
)

for svc in "${SERVICES[@]}"; do
  NAME="${svc%%:*}"
  CONTEXT="${svc##*:}"
  TAG="$REGISTRY/$NAME:latest"
  echo "  Building $TAG ..."
  docker build -t "$TAG" "$CONTEXT"
done

echo "==> Pushing images to $REGISTRY ..."
for svc in "${SERVICES[@]}"; do
  NAME="${svc%%:*}"
  TAG="$REGISTRY/$NAME:latest"
  docker push "$TAG"
done

echo "==> Images pushed."

# ── Deploy to remote ───────────────────────────────────────────
echo "==> Deploying to $REMOTE ..."

ssh "$REMOTE" bash -s "$REPO" "$APP_DIR" "$REGISTRY" <<'REMOTE_SCRIPT'
set -euo pipefail
REPO="$1"
APP_DIR="$2"
REGISTRY="$3"

# Install Docker if missing
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# Clone or pull repo (for compose file, Caddyfile, .env)
if [ ! -d "$APP_DIR" ]; then
  echo "==> Cloning repo..."
  git clone "$REPO" "$APP_DIR"
else
  echo "==> Pulling latest config..."
  cd "$APP_DIR"
  git pull --ff-only
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "=========================================="
  echo "  .env created from .env.example"
  echo "  Edit it before the first deploy:"
  echo "    nano $APP_DIR/.env"
  echo "  Then re-run this script."
  echo "=========================================="
  exit 0
fi

# Login to GHCR if not already (uses token from env or prompts)
if ! docker pull "$REGISTRY/ramblingradio:latest" &>/dev/null 2>&1; then
  echo "==> Note: if images are private, run:"
  echo "    echo \$GHCR_TOKEN | docker login ghcr.io -u 6cubed --password-stdin"
fi

echo "==> Pulling images..."
docker compose pull --ignore-pull-failures

echo "==> Starting services..."
docker compose up -d --remove-orphans

echo "==> Running containers:"
docker compose ps

echo "==> Done."
REMOTE_SCRIPT
