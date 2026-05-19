#!/usr/bin/env sh
# Fail the Docker build if @216labs/errors is not runnable from node_modules (compiled dist/*.cjs).
# Usage: ./scripts/verify-errors-node-runtime.sh [app_dir]
set -eu
APP_DIR="${1:-.}"
cd "$APP_DIR"
ERRORS="node_modules/@216labs/errors"
if [ ! -f "$ERRORS/dist/express.cjs" ]; then
  echo "verify-errors-node-runtime: missing $ERRORS/dist/express.cjs (run npm run build in packages/errors)" >&2
  exit 1
fi
node -e "require('@216labs/errors/express'); require('@216labs/errors');"
if [ -f dist/index.cjs ] && grep -q '@216labs/errors/src' dist/index.cjs 2>/dev/null; then
  echo "verify-errors-node-runtime: dist/index.cjs still references @216labs/errors/src" >&2
  exit 1
fi
echo "verify-errors-node-runtime: ok"
