#!/usr/bin/env bash
# Audit which apps can report client errors to admin (layout + Docker + optional live ingest).
# Usage: ./scripts/audit-client-error-reporting.sh [--live]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIVE=0
[[ "${1:-}" == "--live" ]] && LIVE=1

INGEST_URL="${CLIENT_ERROR_INGEST_URL:-https://admin.6cubed.app/api/public/report-error}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
ylw() { printf '\033[33m%s\033[0m\n' "$*"; }

find_layout() {
  local app_dir="$1"
  find "$app_dir" -path '*/src/app/layout.tsx' -o -path '*/app/layout.tsx' 2>/dev/null | head -1
}

has_errors_dep() {
  grep -q '@216labs/errors' "$1/package.json" 2>/dev/null
}

has_reporter() {
  local layout="$1"
  local app_dir="$2"
  if [[ -f "$layout" ]] && grep -q 'ClientErrorReporter' "$layout"; then
    return 0
  fi
  local main
  main="$(find "$app_dir" \( -path '*/client/src/main.tsx' -o -path '*/src/main.tsx' \) 2>/dev/null | head -1)"
  [[ -n "$main" && -f "$main" ]] && grep -q 'installBrowserErrorReporting' "$main"
}

docker_ok() {
  local id="$1"
  local block
  block="$(awk "/^  ${id}:/{flag=1;next} /^  [a-zA-Z0-9_-]+:/{flag=0} flag" "$ROOT/docker-compose.yml")"
  if echo "$block" | grep -q 'context: \.'; then
    echo "repo-root"
  elif echo "$block" | grep -qE 'build: \./'; then
    echo "subdir"
  else
    echo "unknown"
  fi
}

echo "=== Client error reporting audit ==="
echo "Ingest: $INGEST_URL"
echo

missing=0
while IFS= read -r pkg; do
  app_dir="$(dirname "$pkg")"
  rel="${app_dir#$ROOT/}"
  id=""
  if [[ -f "$app_dir/manifest.json" ]]; then
    id="$(python3 -c "import json; print(json.load(open('$app_dir/manifest.json')).get('id',''))" 2>/dev/null || true)"
  fi
  [[ -z "$id" ]] && id="$(basename "$app_dir")"
  layout="$(find_layout "$app_dir")"
  rep="no"
  has_reporter "${layout:-}" "$app_dir" && rep="yes"
  dk="$(docker_ok "$id" 2>/dev/null || echo unknown)"

  status="OK"
  notes=()
  [[ "$rep" != "yes" ]] && { status="GAP"; notes+=("add ClientErrorReporter to layout"); missing=$((missing + 1)); }
  [[ "$dk" == "subdir" ]] && notes+=("Docker build context not repo-root — GHCR may miss @216labs/errors")

  if [[ "$LIVE" == 1 && "$rep" == "yes" ]]; then
    origin="https://${id}.6cubed.app"
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$INGEST_URL" \
      -H 'Content-Type: application/json' -H "Origin: $origin" \
      -d "{\"message\":\"audit probe\",\"kind\":\"client\",\"app_id\":\"$id\"}" || echo "000")
  if [[ "$code" == "201" || "$code" == "204" ]]; then
      notes+=("ingest ${code}")
    else
      status="WARN"
      notes+=("ingest HTTP ${code}")
    fi
  fi

  line="$id ($rel): reporter=$rep docker=$dk → $status"
  if ((${#notes[@]})); then
    line+=" [$(IFS='; '; echo "${notes[*]}")]"
  fi
  if [[ "$status" == "OK" ]]; then grn "$line"; elif [[ "$status" == "GAP" ]]; then red "$line"; else ylw "$line"; fi
done < <(find "$ROOT/products" -name package.json 2>/dev/null | while read -r p; do
  has_errors_dep "$(dirname "$p")" && echo "$p"
done)

echo
if ((missing > 0)); then
  red "$missing app(s) need ClientErrorReporter in layout (see packages/errors/README.md)"
  exit 1
fi
grn "All @216labs/errors apps have ClientErrorReporter wired in code."
