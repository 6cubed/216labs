#!/usr/bin/env bash
# Optional: start a small edge + demos stack for local smoke tests.
# Requires .env (see .env.example) and a generated Caddyfile.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
python3 scripts/generate-caddyfile.py
docker compose up -d caddy activator admin landing hello-nextjs hello-flask
echo "Up: caddy, activator, admin, landing, hello-nextjs, hello-flask"
echo "With APP_HOST=localhost, use /etc/hosts or similar for subdomains if needed."
