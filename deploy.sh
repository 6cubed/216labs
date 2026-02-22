#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh [user@host]
#
# Deploys the 216labs stack to a remote droplet via SSH.
# First run: pass your droplet address to set up Docker and clone the repo.
# Subsequent runs: pulls latest code and rebuilds containers.
#
# Prerequisites on the droplet:
#   - Docker + Docker Compose (installed automatically on first run)
#   - SSH access with key-based auth

REMOTE="${1:-${DEPLOY_HOST:-}}"
REPO="git@github.com:6cubed/216labs.git"
APP_DIR="/opt/216labs"

if [ -z "$REMOTE" ]; then
  echo "Usage: ./deploy.sh user@droplet-ip"
  echo "  or set DEPLOY_HOST=user@droplet-ip"
  exit 1
fi

echo "==> Deploying to $REMOTE"

ssh "$REMOTE" bash -s "$REPO" "$APP_DIR" <<'REMOTE_SCRIPT'
set -euo pipefail
REPO="$1"
APP_DIR="$2"

# Install Docker if missing
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# Clone or pull
if [ ! -d "$APP_DIR" ]; then
  echo "==> Cloning repo..."
  git clone "$REPO" "$APP_DIR"
  echo "==> IMPORTANT: copy .env.example to .env and configure it:"
  echo "    nano $APP_DIR/.env"
else
  echo "==> Pulling latest..."
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

echo "==> Building and starting services..."
docker compose up -d --build --remove-orphans

echo "==> Running containers:"
docker compose ps

echo "==> Done."
REMOTE_SCRIPT
