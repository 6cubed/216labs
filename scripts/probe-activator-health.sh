#!/usr/bin/env bash
# Probe activator healthz on the droplet (via container localhost).
# Usage: ./scripts/probe-activator-health.sh [user@host]
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
      echo "[activator] FAIL after $tries tries (ssh refused/flaked)" >&2
      echo "hint: ./scripts/wait-for-ssh.sh $REMOTE; then ./scripts/heartbeat-recover.sh $REMOTE" >&2
      exit 1
    fi
    sleep 2
    continue
  fi
  out="$(
    ssh "${SSH_OPTS[@]}" "$REMOTE" \
      "docker exec 216labs-activator-1 python3 -c \"import json,urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8001/healthz', timeout=6).read().decode('utf-8'))\"" 2>/dev/null || true
  )"
  if [[ -n "$out" ]] && echo "$out" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
    echo "[activator] OK: $out"
    exit 0
  fi
  if [[ "$tries" -ge "$max_tries" ]]; then
    echo "[activator] FAIL after $tries tries (docker/wget flaked)" >&2
    echo "hint: ./scripts/heartbeat-recover.sh $REMOTE" >&2
    exit 1
  fi
  sleep 2
done

