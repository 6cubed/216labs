#!/usr/bin/env bash
# Retry SSH when the droplet resets connections (MaxStartups / brief network blips).
# Usage: source "$(dirname "$0")/lib/ssh-retry.sh"   # from scripts/
#        ssh_with_retry user@host 'remote command'
ssh_with_retry() {
  local remote="$1"
  shift
  local max="${SSH_RETRY_MAX:-4}"
  local delay="${SSH_RETRY_DELAY_SEC:-4}"
  local attempt=1
  local rc=255
  while ((attempt <= max)); do
    if ssh -o ConnectTimeout=20 -o BatchMode=yes -o ServerAliveInterval=5 "$remote" "$@"; then
      return 0
    fi
    rc=$?
    if ((attempt < max)); then
      sleep "$delay"
    fi
    attempt=$((attempt + 1))
  done
  return "$rc"
}
