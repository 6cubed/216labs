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
# Read via cron-runner container: it uses WAL on 216labs.db; host sqlite3 can be stale or
# TRUNCATE checkpoint while containers run risks corruption.
CRON_SNAPSHOT=""
for attempt in 1 2 3; do
  CRON_SNAPSHOT=$(
    ssh "${SSH_OPTS[@]}" "$REMOTE" 'docker exec 216labs-cron-runner-1 node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(process.env.DATABASE_PATH || \"/app/216labs.db\");
const keys = [\"stack_health_last\", \"revenue_env_last\"];
const out = {};
for (const key of keys) {
  const row = db.prepare(\"SELECT value FROM cron_runner_state WHERE key = ? LIMIT 1\").get(key);
  if (row && row.value) out[key] = row.value;
}
console.log(JSON.stringify(out));
"' 2>/dev/null || true
  )
  if [[ -n "$CRON_SNAPSHOT" ]]; then
    break
  fi
  [[ "$attempt" -lt 3 ]] && sleep 2
done

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
        at = d.get('at', '')
        if at:
            try:
                from datetime import datetime, timezone
                ts = datetime.fromisoformat(at.replace('Z', '+00:00'))
                age_h = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
                if age_h > 1:
                    print(f'    (stale — {age_h:.0f}h old; cron stack-health-check should run every 15m)')
            except Exception:
                pass
        for side in ('external', 'internal'):
            for r in d.get(side) or []:
                st = 'OK' if r.get('ok') else 'FAIL'
                print(f\"    {side[:3]} {r.get('id')}: {st} ({r.get('error') or r.get('status')})\")
    elif key == 'revenue_env_last':
        issues = d.get('issues', 0)
        print(f'    issues: {issues}')
        at = d.get('at', '')
        if at:
            try:
                from datetime import datetime, timezone
                ts = datetime.fromisoformat(at.replace('Z', '+00:00'))
                age_h = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
                if age_h > 2:
                    print(f'    (stale — {age_h:.1f}h old; run ./scripts/run-droplet-cron.sh revenue-env-check)')
            except Exception:
                pass
        for r in d.get('results') or []:
            rid = r.get('id')
            if rid in ('storybook', '1pageresearch'):
                ready = r.get('ready')
                pre = r.get('preorderConfigured')
                if ready:
                    print(f'    {rid}: checkout ready')
                elif pre:
                    print(f'    {rid}: preorder live')
                elif r.get('ok'):
                    extra = ''
                    if rid == 'storybook' and r.get('waitlistCount') is not None:
                        extra = ' · waitlist ' + str(r.get('waitlistCount'))
                    print(f'    {rid}: checkout not ready' + extra)
                else:
                    print(f\"    {rid}: {r.get('error') or r.get('status')}\")
            elif not r.get('ok'):
                print(f\"    {rid}: {r.get('error') or r.get('status')}\")
" 2>/dev/null || echo "  (could not parse cron snapshot)"
else
  echo "  (SSH unavailable or DB unreadable — skip cron snapshot)"
fi

# Refresh revenue snapshot when stale (cron is every 4h; heartbeats should not show 2h+ old data).
if [[ -n "${CRON_SNAPSHOT:-}" ]] && [[ "${HEARTBEAT_SKIP_REVENUE_REFRESH:-}" != "1" ]]; then
  stale_rev=$(
    printf '%s' "$CRON_SNAPSHOT" | python3 -c "
import sys, json
from datetime import datetime, timezone
raw = sys.stdin.read().strip()
if not raw:
    raise SystemExit(1)
data = json.loads(raw)
if 'revenue_env_last' not in data:
    raise SystemExit(1)
d = json.loads(data['revenue_env_last'])
at = d.get('at', '')
if not at:
    raise SystemExit(1)
ts = datetime.fromisoformat(at.replace('Z', '+00:00'))
age_h = (datetime.now(timezone.utc) - ts).total_seconds() / 3600
print('yes' if age_h > 2 else 'no')
" 2>/dev/null || echo "no"
  )
  if [[ "$stale_rev" == "yes" ]]; then
    echo "  (revenue_env_last stale — refreshing…)"
    if "$ROOT/scripts/run-droplet-cron.sh" revenue-env-check 2>&1 | tail -1; then
      echo "  (refreshed stale revenue_env_last via revenue-env-check)"
      CRON_SNAPSHOT=$(
        ssh "${SSH_OPTS[@]}" "$REMOTE" 'docker exec 216labs-cron-runner-1 node -e "
const Database = require(\"better-sqlite3\");
const db = new Database(process.env.DATABASE_PATH || \"/app/216labs.db\");
const keys = [\"stack_health_last\", \"revenue_env_last\"];
const out = {};
for (const key of keys) {
  const row = db.prepare(\"SELECT value FROM cron_runner_state WHERE key = ? LIMIT 1\").get(key);
  if (row && row.value) out[key] = row.value;
}
console.log(JSON.stringify(out));
"' 2>/dev/null || true
      )
      if [[ -n "$CRON_SNAPSHOT" ]]; then
        printf '%s' "$CRON_SNAPSHOT" | python3 -c "
import sys, json
raw = sys.stdin.read().strip()
data = json.loads(raw)
d = json.loads(data['revenue_env_last'])
print(f\"  [revenue_env_last] at {d.get('at', '?')} (refreshed)\")
print(f\"    issues: {d.get('issues', 0)}\")
for r in d.get('results') or []:
    rid = r.get('id')
    if rid in ('storybook', '1pageresearch'):
        ready = r.get('ready')
        pre = r.get('preorderConfigured')
        if ready:
            print(f'    {rid}: checkout ready')
        elif pre:
            print(f'    {rid}: preorder live')
        elif r.get('ok'):
            extra = ''
            if rid == 'storybook' and r.get('waitlistCount') is not None:
                extra = ' · waitlist ' + str(r.get('waitlistCount'))
            print(f'    {rid}: checkout not ready' + extra)
" 2>/dev/null || true
      fi
    fi
  fi
fi

echo
echo "=== Droplet disk ==="
DISK_LINE=""
for attempt in 1 2 3; do
  DISK_LINE=$(ssh "${SSH_OPTS[@]}" "$REMOTE" 'df -h / | tail -1' 2>/dev/null || true)
  if [[ -n "$DISK_LINE" ]]; then
    break
  fi
  [[ "$attempt" -lt 3 ]] && sleep 2
done
if [[ -n "$DISK_LINE" ]]; then
  echo "  $DISK_LINE"
  DISK_PCT=$(
    echo "$DISK_LINE" | awk '{gsub(/%/,"",$5); print $5}' 2>/dev/null || echo "0"
  )
  if [[ "$DISK_PCT" =~ ^[0-9]+$ ]]; then
    if [[ "$DISK_PCT" -ge 92 ]]; then
      echo "  CRITICAL: root ≥92% — SSH/recover may flap; run ./scripts/prune-droplet-docker.sh $REMOTE" >&2
      if [[ "${HEARTBEAT_AUTO_PRUNE_DISK:-}" == "1" && "$DISK_PCT" -ge 90 ]]; then
        echo "  (HEARTBEAT_AUTO_PRUNE_DISK=1 — pruning…)" >&2
        "$ROOT/scripts/prune-droplet-docker.sh" "$REMOTE" 2>&1 | sed 's/^/    /' || true
      fi
    elif [[ "$DISK_PCT" -ge 88 ]]; then
      echo "  WARN: root ≥88% — ./scripts/prune-droplet-docker.sh $REMOTE before next recover" >&2
    fi
  fi
else
  echo "  (SSH unavailable — skip disk check)"
fi

echo
echo "=== Evictable hot pool ==="
HOT_POOL=$(
  ssh "${SSH_OPTS[@]}" "$REMOTE" 'cd /opt/216labs && docker compose --env-file .env ps --status running --format "{{.Service}}" 2>/dev/null' || true
)
if [[ -n "$HOT_POOL" ]]; then
  python3 -c "
import sys
spine = set('caddy activator admin landing cron-runner storybook maxlearn 1pageresearch kidgift'.split())
humans = set('anchor-api zurichrunclubs'.split())
svcs = [s.strip() for s in sys.stdin.read().splitlines() if s.strip()]
hot = [s for s in svcs if s.lower() not in spine]
kept = [s for s in hot if s.lower() in humans]
extra = [s for s in hot if s.lower() not in humans]
if hot:
    print('  ' + ' '.join(hot))
    bits = []
    if kept:
        bits.append('human-visited: ' + ' '.join(kept))
    if extra:
        bits.append('other: ' + ' '.join(extra) + ' (often bot-woken)')
    bits.append('do not start more')
    print('  (' + '; '.join(bits) + ')')
else:
    print('  (none — only spine)')
" <<< "$HOT_POOL"
else
  echo "  (SSH unavailable — skip hot pool)"
fi

echo
echo "=== Cold refs on always-on HTML ==="
python3 -c "
import re, urllib.request, urllib.error
class N(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None
cold = ('blog.6cubed.app', 'agitweet.6cubed.app', 'merch.6cubed.app', 'marketing.6cubed.app')
hits = []
for url in ('https://6cubed.app/', 'https://6cubed.app/about'):
    try:
        r = urllib.request.build_opener(N).open(url, timeout=12)
        b = r.read().decode('utf-8', 'replace')
    except Exception as e:
        print('  ' + url + ' ' + type(e).__name__)
        continue
    refs = re.findall(r'''(?:href|src|action)\s*=\s*[\"']([^\"']+)[\"']''', b, re.I)
    refs += re.findall(r'''fetch\(\s*[\"']([^\"']+)[\"']''', b)
    bad = [u for u in refs if any(c in u for c in cold)]
    if bad:
        hits.extend(bad)
        print('  ' + url + ' ' + ' '.join(bad))
        print('  (strip href/fetch — do not start those apps)')
if not hits:
    print('  (none — no href/fetch/src to blog, agitweet, merch, marketing)')
" || echo "  (scan failed)"

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
