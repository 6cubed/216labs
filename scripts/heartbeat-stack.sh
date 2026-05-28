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
echo "=== Droplet cron snapshot ==="
# Host often has no sqlite3 CLI; use python3 against /opt/216labs/216labs.db.
CRON_SNAPSHOT=$(
  ssh "${SSH_OPTS[@]}" "$REMOTE" 'python3 - <<'"'"'PY'"'"'
import json
import sqlite3

keys = ("stack_health_last", "revenue_env_last")
try:
    conn = sqlite3.connect("/opt/216labs/216labs.db")
    # cron-runner uses WAL; host sqlite3 without checkpoint can read stale cron_runner_state.
    conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
except OSError:
    raise SystemExit(1)
out = {}
for key in keys:
    row = conn.execute(
        "SELECT value FROM cron_runner_state WHERE key = ? LIMIT 1", (key,)
    ).fetchone()
    if row and row[0]:
        out[key] = row[0]
print(json.dumps(out))
PY
' 2>/dev/null || true
)

if [[ -n "$CRON_SNAPSHOT" ]]; then
  printf '%s' "$CRON_SNAPSHOT" | python3 -c "
import sys, json
raw = sys.stdin.read().strip()
if not raw:
    print('  (no snapshot rows in cron_runner_state)')
    raise SystemExit(0)
data = json.loads(raw)
for key in ('stack_health_last', 'revenue_env_last'):
    if key not in data:
        print(f'  {key}: (not set yet)')
        continue
    d = json.loads(data[key])
    print(f'  [{key}] at {d.get(\"at\", \"?\")}')
    if key == 'stack_health_last':
        print('    diagnosis:', d.get('diagnosis'))
        for side in ('external', 'internal'):
            for r in d.get(side) or []:
                st = 'OK' if r.get('ok') else 'FAIL'
                print(f\"    {side[:3]} {r.get('id')}: {st} ({r.get('error') or r.get('status')})\")
    elif key == 'revenue_env_last':
        issues = d.get('issues', 0)
        print(f'    issues: {issues}')
        for r in d.get('results') or []:
            if not r.get('ok'):
                print(f\"    {r.get('id')}: {r.get('error') or r.get('status')}\")
" 2>/dev/null || echo "  (could not parse cron snapshot)"
else
  echo "  (SSH unavailable or DB unreadable — skip cron snapshot)"
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
