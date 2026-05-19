#!/usr/bin/env sh
# Verify a built Docker image can require() compiled @216labs/errors (not raw .ts).
# Usage: ./scripts/verify-image-errors-runtime.sh <image-ref>
set -eu
IMAGE="${1:?image ref, e.g. 216labs/ramblingradio:latest}"
docker run --rm --entrypoint sh "$IMAGE" -c \
  'test -f node_modules/@216labs/errors/dist/express.cjs && node -e "require('\''@216labs/errors/express'\'')"'
echo "verify-image-errors-runtime: ok ($IMAGE)"
