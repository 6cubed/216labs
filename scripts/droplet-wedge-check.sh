#!/usr/bin/env bash
# Diagnose droplet wedge: ping, SSH error class, one HTTPS probe. Prints next command.
# Usage: ./scripts/droplet-wedge-check.sh [user@host]
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"
IP="${REMOTE#*@}"
if [[ "$IP" == "$REMOTE" ]]; then
  IP="$REMOTE"
  REMOTE="root@$IP"
fi

SSH_OPTS=(-o ConnectTimeout=10 -o BatchMode=yes -o ServerAliveInterval=5 -o ServerAliveCountMax=2)

echo "=== Droplet wedge check ($IP) ==="

ping_ok=0
if ping -c 1 -W 3 "$IP" >/dev/null 2>&1; then
  echo "  ping: OK"
  ping_ok=1
else
  echo "  ping: no reply (host down, firewall, or ICMP blocked)"
fi

ssh_state="fail"
ssh_err=""
if out="$(ssh "${SSH_OPTS[@]}" "$REMOTE" 'echo ok' 2>&1)" && [[ "$out" == "ok" ]]; then
  echo "  ssh: OK"
  ssh_state="ok"
else
  ssh_err="$out"
  if echo "$ssh_err" | grep -qi 'connection refused'; then
    echo "  ssh: connection refused (sshd down or not listening)"
    ssh_state="refused"
  elif echo "$ssh_err" | grep -qiE 'banner exchange|timed out during banner'; then
    echo "  ssh: banner hang (often disk ~90%+ full or OOM)"
    ssh_state="hang"
  else
    echo "  ssh: unreachable"
    echo "       $(echo "$ssh_err" | tail -1 | sed 's/^/       /')"
  fi
fi

admin_code="$(curl -sS -m 8 -o /dev/null -w '%{http_code}' "https://admin.6cubed.app/healthz" 2>/dev/null || echo "000")"
echo "  https admin.6cubed.app/healthz: $admin_code"

echo
echo "Diagnosis:"
if [[ "$ping_ok" -eq 0 && "$admin_code" == "000" && "$ssh_state" != "ok" ]]; then
  echo "  Likely total outage (power, network, or hypervisor)."
  echo "Next:"
  echo "  1. https://cloud.digitalocean.com/droplets → $IP → Power → Reboot"
  echo "  2. ./scripts/wait-for-droplet.sh $REMOTE"
elif [[ "$ssh_state" == "refused" || "$ssh_state" == "hang" ]] && [[ "$admin_code" == "000" ]]; then
  echo "  VPS wedged — edge and SSH both down (typical at 92%+ disk)."
  echo "Next:"
  echo "  1. DO Power → Reboot (or DIGITALOCEAN_ACCESS_TOKEN=… ./scripts/droplet-reboot.sh)"
  echo "  2. ./scripts/wait-for-droplet.sh $REMOTE"
elif [[ "$ssh_state" == "ok" && "$admin_code" == "000" ]]; then
  echo "  SSH works but HTTPS edge is down — Docker/Caddy on the host."
  echo "Next: ./scripts/droplet-spine-up.sh $REMOTE"
elif [[ "$ssh_state" == "ok" ]]; then
  echo "  SSH OK. If edge-smoke still fails: ./scripts/droplet-recover.sh $REMOTE"
else
  echo "  Mixed failure — try reboot, then wait-for-droplet + recover."
  echo "Next: ./scripts/droplet-reboot.sh  OR  DO dashboard Reboot → ./scripts/wait-for-droplet.sh"
fi
