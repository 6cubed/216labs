#!/usr/bin/env bash
# Heartbeat entrypoint: edge smoke + optional droplet cron snapshot + next action.
# Usage: ./scripts/heartbeat-stack.sh [user@host]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"
SSH_OPTS=(-o ConnectTimeout=12 -o BatchMode=yes)

echo "=== Heartbeat stack ==="
smoke_ok=0
if "$ROOT/scripts/edge-smoke.sh"; then
  smoke_ok=1
fi

echo
echo "=== Droplet cron snapshot (stack_health_last) ==="
if ssh "${SSH_OPTS[@]}" "$REMOTE" "sqlite3 /opt/216labs/216labs.db \"SELECT value FROM cron_runner_state WHERE key='stack_health_last' LIMIT 1\"" 2>/dev/null | python3 -c "
import sys, json
raw = sys.stdin.read().strip()
if not raw:
    print('  (no snapshot — cron-runner may be down or job not run yet)')
    sys.exit(0)
d = json.loads(raw)
print('  diagnosis:', d.get('diagnosis'))
print('  at:', d.get('at'))
for side in ('external', 'internal'):
    for r in d.get(side) or []:
        st = 'OK' if r.get('ok') else 'FAIL'
        print(f\"  {side[:3]} {r.get('id')}: {st} ({r.get('error') or r.get('status')})\")
" 2>/dev/null; then
  :
else
  echo "  (SSH unavailable — skip DB snapshot)"
fi

echo
if [[ "$smoke_ok" -eq 1 ]]; then
  echo "Lights on. Revenue: ./scripts/check-revenue-env-http.sh"
  exit 0
fi

if "$ROOT/scripts/heartbeat-recover.sh" "$REMOTE"; then
  exit 0
fi
rc=$?
if [[ "$rc" -eq 2 ]]; then
  echo "See docs/STACK-HEALTH.md and docs/DROPLET-RECOVERY.md"
fi
exit "$rc"
