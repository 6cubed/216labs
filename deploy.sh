#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh user@host
#
# Reads 216labs.db (SQLite) to decide which apps to build/transfer.
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

# ── Service mapping helpers (Bash 3 compatible) ───────────────
service_spec() {
  case "$1" in
    ramblingradio) echo "./RamblingRadio" ;;
    stroll) echo "./Stroll.live" ;;
    oneroom) echo "./oneroom" ;;
    onefit) echo "./onefit" ;;
    paperframe|paperframe-frontend) echo "./paperframe/frontend" ;;
    hivefind) echo "./hivefind" ;;
    pipesecure) echo "./pipesecure" ;;
    pipesecure-worker) echo "./pipesecure:Dockerfile.worker" ;;
    admin) echo "./216labs_admin" ;;
    agimemes) echo "./agimemes.com" ;;
    agitshirts) echo "./agitshirts" ;;
    priors) echo "./priors" ;;
    calibratedai) echo "./calibratedai" ;;
    anchor-api) echo "./anchor/backend" ;;
    anchor-web) echo "./anchor/frontend" ;;
    artisinaleurope) echo "./artisinaleurope" ;;
    thezurichdatinggame) echo "./thezurichdatinggame" ;;
    1pageresearch) echo "./1pageresearch" ;;
    audioaicheckup) echo "./audioaicheckup" ;;
    storybook) echo "./storybook" ;;
    *) echo "" ;;
  esac
}

service_deps() {
  case "$1" in
    pipesecure) echo "redis pipesecure-worker pipesecure-migrate" ;;
    *) echo "" ;;
  esac
}

if [ -f "$DB_FILE" ]; then
  ENABLED_APPS=$(sqlite3 "$DB_FILE" "SELECT id FROM apps WHERE deploy_enabled = 1 OR id = 'admin'" | tr '\n' ' ')
  if [[ " $ENABLED_APPS " != *" admin "* ]]; then
    ENABLED_APPS="$ENABLED_APPS admin"
  fi
  echo "==> Deploy config (from DB): $ENABLED_APPS"
  echo "==> Building deploy env from admin DB..."
  HAS_ENV_TABLE=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='env_vars';")
  if [ "$HAS_ENV_TABLE" = "1" ]; then
    sqlite3 -separator '|' "$DB_FILE" "SELECT key, value FROM env_vars WHERE value IS NOT NULL AND value != '' ORDER BY key;" \
      | while IFS='|' read -r key value; do
          [ -z "${key:-}" ] && continue
          printf '%s="%s"\n' "$key" "$(escape_env_value "$value")" >> "$DB_ENV_FILE"
        done
    ENV_COUNT=$(wc -l < "$DB_ENV_FILE" | tr -d ' ')
    echo "==> Loaded $ENV_COUNT env vars from admin DB"
  else
    echo "==> env_vars table not found yet, using .env defaults only"
  fi
else
  echo "==> No $DB_FILE found, deploying all apps"
  ENABLED_APPS="ramblingradio stroll onefit paperframe-frontend hivefind pipesecure admin agimemes agitshirts priors"
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
if [ ${#BUILT_IMAGES[@]} -eq 0 ]; then
  echo "==> All images up to date, skipping transfer"
else
  echo "==> Transferring ${#BUILT_IMAGES[@]}/${#ALL_IMAGES[@]} images to $REMOTE..."
  docker save "${BUILT_IMAGES[@]}" | gzip | ssh "${SSH_OPTS[@]}" "$REMOTE" 'docker load'
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
COMPOSE_SERVICES="caddy postgres"
for app in $ENABLED_APPS; do
  COMPOSE_SERVICES="$COMPOSE_SERVICES $app"
  DEPS=$(service_deps "$app")
  if [ -n "$DEPS" ]; then
    COMPOSE_SERVICES="$COMPOSE_SERVICES $DEPS"
  fi
done

# ── Start on droplet ──────────────────────────────────────────
echo "==> Starting stack on $REMOTE..."
echo "    Services: $COMPOSE_SERVICES"
ENV_B64=""
if [ -s "$DB_ENV_FILE" ]; then
  ENV_B64="$(base64 < "$DB_ENV_FILE" | tr -d '\n')"
fi
ssh "${SSH_OPTS[@]}" "$REMOTE" bash -s "$REPO" "$APP_DIR" "$COMPOSE_SERVICES" "$ENV_B64" <<'REMOTE_SCRIPT'
set -euo pipefail
REPO="$1"
APP_DIR="$2"
COMPOSE_SERVICES="$3"
ENV_B64="$4"

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

if [ -n "$ENV_B64" ]; then
  echo "$ENV_B64" | base64 --decode > .env.admin
else
  : > .env.admin
fi

# Guardrail: never let a malformed env override break deploys.
if LC_ALL=C grep -q '[^[:print:][:space:]]' .env.admin; then
  echo "==> WARNING: .env.admin contains non-text bytes; ignoring admin env overrides"
  : > .env.admin
fi

if ! awk '
  /^[[:space:]]*$/ { next }
  /^[[:space:]]*#/ { next }
  /^[A-Za-z_][A-Za-z0-9_]*=.*/ { next }
  { exit 1 }
' .env.admin; then
  echo "==> WARNING: .env.admin has invalid lines; ignoring admin env overrides"
  : > .env.admin
fi

# shellcheck disable=SC2086
# Important: never build on droplet; only run pre-loaded images.
docker compose --env-file .env --env-file .env.admin up -d --remove-orphans --no-build $COMPOSE_SERVICES
# Force-recreate any services whose image was just updated (compose won't auto-recreate on tag match).
for svc in $COMPOSE_SERVICES; do
  docker compose --env-file .env --env-file .env.admin up -d --no-build --force-recreate "$svc" 2>/dev/null || true
done
docker compose ps
echo "==> Done."
REMOTE_SCRIPT

# ── Collect startup times from container logs ─────────────────
if [ -f "$DB_FILE" ]; then
  echo "==> Collecting startup times..."
  sleep 3

  STARTUP_DATA=$(ssh "${SSH_OPTS[@]}" "$REMOTE" 'cd /opt/216labs && for svc in '"$COMPOSE_SERVICES"'; do
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
