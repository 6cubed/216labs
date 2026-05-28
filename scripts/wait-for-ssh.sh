#!/usr/bin/env bash
# Poll SSH until the host answers.
# Usage: ./scripts/wait-for-ssh.sh [user@host]
# Env: WAIT_MAX_SEC (default 600), WAIT_INTERVAL_SEC (default 10)
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"
MAX="${WAIT_MAX_SEC:-600}"
INTERVAL="${WAIT_INTERVAL_SEC:-10}"
SSH_OPTS=(-o ConnectTimeout=8 -o BatchMode=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=2)

elapsed=0
echo "Waiting for SSH on $REMOTE (max ${MAX}s, interval ${INTERVAL}s)..."

while [[ "$elapsed" -lt "$MAX" ]]; do
  if ssh "${SSH_OPTS[@]}" "$REMOTE" 'echo ok' 2>/dev/null | grep -q ok; then
    echo "SSH up after ${elapsed}s."
    exit 0
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
  echo "  still down (${elapsed}s)..."
done

echo "SSH did not recover within ${MAX}s." >&2
exit 1

