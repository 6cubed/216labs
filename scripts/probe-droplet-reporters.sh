#!/usr/bin/env bash
# Probe client error reporters inside running app containers (localhost HTTP).
# Usage:
#   ./scripts/probe-droplet-reporters.sh              # on the droplet (reads config, docker exec)
#   ./scripts/probe-droplet-reporters.sh user@host    # SSH once, run remote copy of this script
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG="${PROBE_DROPLET_CFG:-$ROOT/config/errors-html-probe-droplet.txt}"
REMOTE="${1:-}"

run_probes() {
  local fails=0
  [[ -f "$CFG" ]] || { echo "probe-droplet-reporters: missing $CFG" >&2; return 1; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    id="$(echo "${line%%|*}" | tr -d '[:space:]')"
    [[ -z "$id" ]] && continue
    port="$(echo "${line##*|}" | tr -d '[:space:]')"
    [[ "$port" == "$id" || -z "$port" ]] && port="5000"
    ctr="216labs-${id}-1"
    if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$ctr"; then
      echo "  WARN: $id ($ctr): container not running" >&2
      fails=$((fails + 1))
      continue
    fi
    probe_py="import re,sys,urllib.request as u; h=u.urlopen('http://127.0.0.1:${port}/',timeout=20).read().decode(); sys.exit(0 if ('report-error' in h or any('report-error' in u.urlopen('http://127.0.0.1:${port}'+m.group(0),timeout=20).read().decode() for p in (r'/assets/[a-zA-Z0-9_.-]+\\.js',r'/_next/static/[a-zA-Z0-9_.-]+\\.js') for m in (re.search(p,h),) if m)) else 1)"
    probe_js="const http=require('http');const P=${port};function get(p,cb){http.get('http://127.0.0.1:'+P+p,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>cb(d));}).on('error',()=>process.exit(2));}get('/',h=>{if(h.includes('report-error'))process.exit(0);const m=h.match(/\\/(assets|_next\\/static)\\/[a-zA-Z0-9_.-]+\\.js/);if(!m)process.exit(1);get(m[0],j=>process.exit(j.includes('report-error')?0:1));});"
    ok=0
    detail=""
    for attempt in 1 2 3; do
      if docker exec "$ctr" node -e "$probe_js" >/dev/null 2>&1; then
        ok=1
        detail="reporter in page or JS bundle"
        break
      fi
      if docker exec "$ctr" python3 -c "$probe_py" >/dev/null 2>&1; then
        ok=1
        detail="reporter in page or JS bundle"
        break
      fi
      [[ "$attempt" -lt 3 ]] && sleep 5
    done
    if ((ok)); then
      echo "  $id (container :${port}): ${detail}"
    else
      echo "  WARN: $id ($ctr :${port}): no report-error in HTML or JS bundle" >&2
      fails=$((fails + 1))
    fi
  done <"$CFG"
  return "$fails"
}

if [[ -n "$REMOTE" ]]; then
  exec ssh -o ConnectTimeout=15 -o BatchMode=yes "$REMOTE" \
    "cd /opt/216labs && git pull -q 2>/dev/null || true && ./scripts/probe-droplet-reporters.sh"
fi

run_probes
