#!/usr/bin/env bash
# new-app.sh — scaffold a new 216labs project
#
# Usage: ./scripts/new-app.sh <app-id> [nextjs|flask|fastapi]
#
# Creates:
#   <app-id>/manifest.json   — app metadata (source of truth)
#   <app-id>/Dockerfile      — starter Dockerfile
#
# Then prints the docker-compose.yml and Caddyfile snippets to add manually.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

APP_ID="${1:-}"
STACK="${2:-nextjs}"

if [ -z "$APP_ID" ]; then
  echo "Usage: ./scripts/new-app.sh <app-id> [nextjs|flask|fastapi]"
  echo "  app-id   lowercase letters, numbers, hyphens (e.g. myapp)"
  echo "  stack    nextjs (default), flask, fastapi"
  exit 1
fi

APP_DIR="$REPO_ROOT/$APP_ID"

if [ -d "$APP_DIR" ]; then
  echo "Error: directory $APP_DIR already exists"
  exit 1
fi

# ── Determine port based on stack ─────────────────────────────
case "$STACK" in
  nextjs|fastapi) INTERNAL_PORT=3000 ;;
  flask)          INTERNAL_PORT=5000 ;;
  *)
    echo "Unknown stack: $STACK. Use nextjs, flask, or fastapi."
    exit 1
    ;;
esac

# ── Auto-assign admin tracking port (max existing + 1) ────────
NEXT_PORT=$(python3 - "$REPO_ROOT" << 'PYEOF'
import sys, json, os
repo_root = sys.argv[1]
ports = []
for entry in os.listdir(repo_root):
    manifest_path = os.path.join(repo_root, entry, 'manifest.json')
    if os.path.isfile(manifest_path):
        try:
            with open(manifest_path) as f:
                m = json.load(f)
            # We don't store admin_port in manifests, but we check known ones
        except:
            pass
# Return the next port (we'll let db.ts auto-assign from max+1)
print(8020)
PYEOF
)

# ── Create directory ───────────────────────────────────────────
mkdir -p "$APP_DIR"
echo "Created $APP_DIR"

# ── Write manifest.json ────────────────────────────────────────
cat > "$APP_DIR/manifest.json" << MANIFEST
{
  "id": "$APP_ID",
  "name": "$(echo "$APP_ID" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1')",
  "tagline": "TODO: add a one-line description",
  "description": "TODO: add a longer description",
  "category": "consumer",
  "internal_port": $INTERNAL_PORT,
  "memory_limit": "256m",
  "docker_service": "$APP_ID",
  "build_context": "./$APP_ID",
  "stack": {
    "frontend": null,
    "backend": null,
    "database": null,
    "other": null
  },
  "env_vars": []
}
MANIFEST
echo "Created $APP_DIR/manifest.json"

# ── Write Dockerfile ───────────────────────────────────────────
case "$STACK" in
  nextjs)
    cat > "$APP_DIR/Dockerfile" << 'DOCKERFILE'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
DOCKERFILE
    COMPOSE_SNIPPET="  $APP_ID:
    image: 216labs/$APP_ID:latest
    build: ./$APP_ID
    restart: unless-stopped
    environment:
      - PORT=3000
      - NODE_ENV=production
    expose:
      - \"3000\"
    mem_limit: 256m"
    ;;
  flask)
    cat > "$APP_DIR/Dockerfile" << 'DOCKERFILE'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
DOCKERFILE
    COMPOSE_SNIPPET="  $APP_ID:
    image: 216labs/$APP_ID:latest
    build: ./$APP_ID
    restart: unless-stopped
    environment:
      - PORT=5000
    expose:
      - \"5000\"
    mem_limit: 128m"
    ;;
  fastapi)
    cat > "$APP_DIR/Dockerfile" << 'DOCKERFILE'
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt uvicorn[standard]
COPY . .
EXPOSE 3000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3000"]
DOCKERFILE
    COMPOSE_SNIPPET="  $APP_ID:
    image: 216labs/$APP_ID:latest
    build: ./$APP_ID
    restart: unless-stopped
    environment:
      - PORT=3000
    expose:
      - \"3000\"
    mem_limit: 256m"
    ;;
esac
echo "Created $APP_DIR/Dockerfile"

# ── Print next steps ───────────────────────────────────────────
DOMAIN="${APP_HOST:-agimemes.com}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Scaffolded $APP_ID ($STACK)"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Edit $APP_ID/manifest.json with your app's metadata & env_vars"
echo ""
echo "  2. Add to docker-compose.yml:"
echo ""
echo "$COMPOSE_SNIPPET"
echo ""
echo "  3. Regenerate the Caddyfile:"
echo "     python3 scripts/generate-caddyfile.py"
echo ""
echo "  4. Build your app, then deploy:"
echo "     ./deploy.sh root@46.101.88.197"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
