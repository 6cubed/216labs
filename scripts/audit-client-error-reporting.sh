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

# Vite+Express apps that externalize most deps need packages:"bundle" + @216labs/errors allowlist.
esbuild_errors_ok() {
  local app_dir="$1"
  local build_ts="$app_dir/script/build.ts"
  [[ -f "$build_ts" ]] || return 0
  grep -rq '@216labs/errors' "$app_dir/server" 2>/dev/null || return 0
  grep -q 'const allowlist' "$build_ts" || return 0
  grep -q '@216labs/errors' "$build_ts" || return 1
  grep -qE 'packages:\s*["'\'']bundle["'\'']' "$build_ts" || return 1
  return 0
}

errors_pkg_built_in_docker() {
  local app_dir="$1"
  local df="$app_dir/Dockerfile"
  if [[ ! -f "$df" ]]; then
    local rel="${app_dir#$ROOT/}"
    df="$(find "$ROOT/products" "$ROOT/internal" -maxdepth 5 -name Dockerfile -print 2>/dev/null \
      | while read -r f; do grep -q "$rel" "$f" 2>/dev/null && echo "$f" && break; done | head -1)"
  fi
  [[ -z "$df" || ! -f "$df" ]] && return 0
  grep -q 'packages/errors' "$df" || return 0
  if grep -q 'docker-build-errors-package.sh' "$df"; then
    return 0
  fi
  grep -qE 'WORKDIR /repo/packages/errors' "$df" && grep -q 'npm run build' "$df" || return 1
  return 0
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
  if ! esbuild_errors_ok "$app_dir"; then
    status="GAP"
    notes+=("script/build.ts: add @216labs/errors to allowlist and packages:\"bundle\"")
    missing=$((missing + 1))
  fi
  if ! errors_pkg_built_in_docker "$app_dir"; then
    status="GAP"
    notes+=("Dockerfile: build packages/errors before app (npm run build)")
    missing=$((missing + 1))
  fi
  if has_errors_dep "$app_dir/package.json" 2>/dev/null; then
    nc="$(find "$app_dir" -maxdepth 1 -name 'next.config.*' 2>/dev/null | head -1)"
    if [[ -n "$nc" ]] && ! grep -q '@216labs/errors' "$nc" 2>/dev/null; then
      status="GAP"
      notes+=('next.config: transpilePackages must include "@216labs/errors"')
      missing=$((missing + 1))
    fi
  fi

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
done < <(find "$ROOT/products" \
  \( -path '*/node_modules' -o -path '*/.next' -o -path '*/dist' -o -path '*/.venv' -o -path '*/__pycache__' \) -prune \
  -o -name package.json -print 2>/dev/null | while read -r p; do
  has_errors_dep "$(dirname "$p")" && echo "$p"
done)

echo
echo "=== Stack-specific (not @216labs/errors npm) ==="

audit_extra_app() {
  local id="$1"
  local rel="$2"
  local rep="$3"
  local status="OK"
  local notes=()
  [[ "$rep" != "yes" ]] && { status="GAP"; notes+=("wire client error reporter"); missing=$((missing + 1)); }
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
  line="$id ($rel): reporter=$rep → $status"
  if ((${#notes[@]})); then
    line+=" [$(IFS='; '; echo "${notes[*]}")]"
  fi
  if [[ "$status" == "OK" ]]; then grn "$line"; elif [[ "$status" == "GAP" ]]; then red "$line"; else ylw "$line"; fi
}

ANCHOR_MAIN="$ROOT/products/org-lifestyle/play/anchor/frontend/lib/main.dart"
anchor_rep="no"
[[ -f "$ANCHOR_MAIN" ]] && grep -q 'ErrorReporter.install' "$ANCHOR_MAIN" && anchor_rep="yes"
audit_extra_app "anchor" "products/org-lifestyle/play/anchor/frontend" "$anchor_rep"

HELLO_FLASK="$ROOT/products/org-platform/toolkit-demos/hello-flask"
hello_flask_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$HELLO_FLASK/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$HELLO_FLASK/Dockerfile" 2>/dev/null \
  && grep -q 'report_server_error' "$HELLO_FLASK/app.py" 2>/dev/null; then
  hello_flask_rep="yes"
fi
audit_extra_app "hello-flask" "products/org-platform/toolkit-demos/hello-flask" "$hello_flask_rep"

MEDIATE_DIR="$ROOT/products/org-social/mediate"
mediate_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$MEDIATE_DIR/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$MEDIATE_DIR/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$MEDIATE_DIR/templates/index.html" 2>/dev/null; then
  mediate_rep="yes"
fi
audit_extra_app "mediate" "products/org-social/mediate" "$mediate_rep"

LANDING="$ROOT/products/org-growth/ads/landing"
landing_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$LANDING/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$LANDING/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$LANDING/templates/index.html" 2>/dev/null; then
  landing_rep="yes"
fi
audit_extra_app "landing" "products/org-growth/ads/landing" "$landing_rep"

EMAILGPT="$ROOT/products/org-growth/ads/emailgpt"
emailgpt_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$EMAILGPT/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$EMAILGPT/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$EMAILGPT/templates/index.html" 2>/dev/null; then
  emailgpt_rep="yes"
fi
audit_extra_app "emailgpt" "products/org-growth/ads/emailgpt" "$emailgpt_rep"

GERMANDAILY="$ROOT/products/org-media/germandaily"
germandaily_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$GERMANDAILY/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$GERMANDAILY/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$GERMANDAILY/templates/index.html" 2>/dev/null; then
  germandaily_rep="yes"
fi
audit_extra_app "germandaily" "products/org-media/germandaily" "$germandaily_rep"

RUSSIANDAILY="$ROOT/products/org-media/russiandaily"
russiandaily_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$RUSSIANDAILY/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$RUSSIANDAILY/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$RUSSIANDAILY/templates/index.html" 2>/dev/null; then
  russiandaily_rep="yes"
fi
audit_extra_app "russiandaily" "products/org-media/russiandaily" "$russiandaily_rep"

ONEPAGE="$ROOT/products/org-platform/ai/1pageresearch"
onepage_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$ONEPAGE/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$ONEPAGE/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$ONEPAGE/templates/base.html" 2>/dev/null; then
  onepage_rep="yes"
fi
audit_extra_app "1pageresearch" "products/org-platform/ai/1pageresearch" "$onepage_rep"

LABSHQ="$ROOT/products/org-lifestyle/play/labshq"
labshq_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$LABSHQ/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$LABSHQ/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$LABSHQ/templates/index.html" 2>/dev/null; then
  labshq_rep="yes"
fi
audit_extra_app "labshq" "products/org-lifestyle/play/labshq" "$labshq_rep"

MAXLEARN="$ROOT/products/org-lifestyle/play/maxlearn"
maxlearn_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$MAXLEARN/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$MAXLEARN/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$MAXLEARN/templates/index.html" 2>/dev/null; then
  maxlearn_rep="yes"
fi
audit_extra_app "maxlearn" "products/org-lifestyle/play/maxlearn" "$maxlearn_rep"

BIRDPERCH="$ROOT/products/org-platform/ai/bird-perch"
birdperch_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$BIRDPERCH/app/main.py" 2>/dev/null \
  && grep -q 'client_error_report' "$BIRDPERCH/Dockerfile" 2>/dev/null \
  && grep -q 'CLIENT_ERRORS' "$BIRDPERCH/static/index.html" 2>/dev/null; then
  birdperch_rep="yes"
fi
audit_extra_app "birdperch" "products/org-platform/ai/bird-perch" "$birdperch_rep"

CTFBENCH="$ROOT/products/org-platform/ai/ctfbench"
ctfbench_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$CTFBENCH/app/main.py" 2>/dev/null \
  && grep -q 'client_error_report' "$CTFBENCH/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script' "$CTFBENCH/app/templates/base.html" 2>/dev/null; then
  ctfbench_rep="yes"
fi
audit_extra_app "ctfbench" "products/org-platform/ai/ctfbench" "$ctfbench_rep"

AVATAR="$ROOT/products/org-lifestyle/play/avatar"
avatar_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$AVATAR/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$AVATAR/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$AVATAR/templates/index.html" 2>/dev/null; then
  avatar_rep="yes"
fi
audit_extra_app "avatar" "products/org-lifestyle/play/avatar" "$avatar_rep"

EXPLORE="$ROOT/products/org-platform/local/explore"
explore_rep="no"
if [[ -f "$ROOT/internal/python/client_error_report.py" ]] \
  && grep -q 'client_error_script' "$EXPLORE/app.py" 2>/dev/null \
  && grep -q 'client_error_report' "$EXPLORE/Dockerfile" 2>/dev/null \
  && grep -q 'client_error_script_html' "$EXPLORE/templates/index.html" 2>/dev/null; then
  explore_rep="yes"
fi
audit_extra_app "explore" "products/org-platform/local/explore" "$explore_rep"

PIPESECURE="$ROOT/internal/security/pipesecure"
pipesecure_rep="no"
if grep -q 'clientErrorScript("pipesecure")' "$PIPESECURE/src/status.ts" 2>/dev/null \
  && grep -q 'reportServerError' "$PIPESECURE/src/main.ts" 2>/dev/null \
  && [[ -f "$PIPESECURE/src/error-report.ts" ]]; then
  pipesecure_rep="yes"
fi
audit_extra_app "pipesecure" "internal/security/pipesecure" "$pipesecure_rep"

echo
if ((missing > 0)); then
  red "$missing app(s) need error reporting wired (see packages/errors/README.md)"
  exit 1
fi
grn "All audited apps have client/server error reporting wired in code."
