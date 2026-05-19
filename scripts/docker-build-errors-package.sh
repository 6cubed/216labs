#!/usr/bin/env sh
# Build @216labs/errors dist/*.cjs inside a Docker builder stage (repo root = /repo).
# Copy to Dockerfiles: COPY scripts/docker-build-errors-package.sh /tmp/docker-build-errors-package.sh
# RUN sh /tmp/docker-build-errors-package.sh
set -eu
ROOT="${ERRORS_BUILD_ROOT:-/repo}"
cd "$ROOT/packages/errors"
npm install
npm run build
test -f dist/express.cjs
echo "docker-build-errors-package: ok ($(wc -c < dist/express.cjs) bytes express.cjs)"
