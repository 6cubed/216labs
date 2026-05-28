#!/usr/bin/env bash
# Probe cron-runner HTTP server health on the droplet.
# Usage: ./scripts/probe-cron-runner-health.sh [user@host]
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"
SSH_OPTS=(-o ConnectTimeout=8 -o BatchMode=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=2)

ssh_ok() {
  ssh "${SSH_OPTS[@]}" "$REMOTE" 'echo ok' 2>/dev/null | grep -q ok
}

tries=0
max_tries=5
while true; do
  tries=$((tries + 1))
  if ! ssh_ok; then
    if [[ "$tries" -ge "$max_tries" ]]; then
      echo "[cron-runner] FAIL after $tries tries (ssh refused/flaked)" >&2
      echo "hint: ./scripts/wait-for-ssh.sh $REMOTE; then ./scripts/heartbeat-recover.sh $REMOTE" >&2
      exit 1
    fi
    sleep 2
    continue
  fi
  out="$(
    ssh "${SSH_OPTS[@]}" "$REMOTE" \
      "docker exec 216labs-cron-runner-1 wget -qO- http://127.0.0.1:3029/health" 2>/dev/null || true
  )"
  if [[ -n "$out" ]] && echo "$out" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "[cron-runner] OK: $out"
    exit 0
  fi
  if [[ "$tries" -ge "$max_tries" ]]; then
    echo "[cron-runner] FAIL after $tries tries (docker/wget flaked)" >&2
    echo "hint: ./scripts/heartbeat-recover.sh $REMOTE" >&2
    exit 1
  fi
  sleep 2
done

