#!/usr/bin/env bash
# Remove ghcr.io/6cubed/216labs/* when 216labs/*:latest already exists (saves ~1× image size per app).
# Source from droplet cron scripts: . "$(dirname "$0")/lib/prune-ghcr-duplicate-tags.sh"
prune_ghcr_duplicate_tags() {
  local removed=0
  docker image prune -f >/dev/null 2>&1 || true
  while IFS= read -r img; do
    [[ -z "$img" ]] && continue
    local short="216labs/${img#ghcr.io/6cubed/216labs/}"
    if docker image inspect "$short" >/dev/null 2>&1; then
      if docker rmi "$img" >/dev/null 2>&1; then
        echo "  pruned duplicate $img"
        removed=$((removed + 1))
      fi
    fi
  done < <(docker images --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | grep "^ghcr.io/6cubed/216labs/" || true)
  echo "==> prune_ghcr_duplicate_tags: removed $removed ghcr.io tag(s)"
}
