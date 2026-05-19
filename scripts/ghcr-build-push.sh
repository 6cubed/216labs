#!/usr/bin/env bash
# Build one compose service and push to GHCR (used by .github/workflows/ghcr-publish.yml).
set -euo pipefail

: "${SERVICE:?SERVICE required}"
: "${SRC_IMAGE:?SRC_IMAGE required}"
: "${GITHUB_SHA:?GITHUB_SHA required}"
: "${REGISTRY_PREFIX:=ghcr.io/6cubed/216labs}"

login_ghcr() {
  : "${GITHUB_TOKEN:?GITHUB_TOKEN required for GHCR login}"
  : "${GITHUB_ACTOR:?GITHUB_ACTOR required for GHCR login}"
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
}

for attempt in 1 2 3 4 5; do
  if login_ghcr; then
    break
  fi
  if (( attempt == 5 )); then
    echo "ghcr-build-push: docker login failed after 5 attempts" >&2
    exit 1
  fi
  echo "ghcr-build-push: login retry $((attempt + 1))/5" >&2
  sleep 20
done

PLATFORM="${PLATFORM:-}"
if [[ -n "$PLATFORM" ]]; then
  export DOCKER_DEFAULT_PLATFORM="$PLATFORM"
fi

build_once() {
  docker compose --env-file .env --env-file .env.admin build \
    --build-arg CACHEBUST="${GITHUB_SHA}" \
    "$SERVICE"
}

push_once() {
  local short dest
  short="${SRC_IMAGE#216labs/}"
  short="${short%%:*}"
  dest="${REGISTRY_PREFIX}/${short}:latest"
  docker tag "$SRC_IMAGE" "$dest"
  docker push "$dest"
}

for attempt in 1 2 3; do
  if build_once; then
    break
  fi
  if (( attempt == 3 )); then
    echo "ghcr-build-push: build failed after 3 attempts for $SERVICE" >&2
    exit 1
  fi
  echo "ghcr-build-push: build retry $((attempt + 1))/3 for $SERVICE" >&2
  sleep 20
done

if grep -qx "$SERVICE" config/errors-runtime-services.txt 2>/dev/null; then
  chmod +x scripts/verify-image-errors-runtime.sh
  ./scripts/verify-image-errors-runtime.sh "$SRC_IMAGE"
fi

for attempt in 1 2 3; do
  if push_once; then
    exit 0
  fi
  if (( attempt == 3 )); then
    echo "ghcr-build-push: push failed after 3 attempts for $SERVICE" >&2
    exit 1
  fi
  echo "ghcr-build-push: push retry $((attempt + 1))/3 for $SERVICE" >&2
  sleep 20
done
