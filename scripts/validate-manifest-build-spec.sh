#!/usr/bin/env bash
# Fail if a manifest uses repo-root build_context without build_dockerfile (breaks deploy.sh local builds).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0
while IFS= read -r manifest; do
  ctx="$(python3 -c "import json; m=json.load(open('$manifest')); print(m.get('build_context',''))")"
  dfile="$(python3 -c "import json; m=json.load(open('$manifest')); print(m.get('build_dockerfile') or '')")"
  id="$(python3 -c "import json; m=json.load(open('$manifest')); print(m.get('id','?'))")"
  if [[ "$ctx" == "." || "$ctx" == "./" ]]; then
    if [[ -z "$dfile" ]]; then
      echo "ERROR: $manifest (id=$id) has build_context \".\" but no build_dockerfile" >&2
      fail=1
    elif [[ ! -f "$dfile" ]]; then
      echo "ERROR: $manifest (id=$id) build_dockerfile missing on disk: $dfile" >&2
      fail=1
    fi
  fi
done < <(find products internal -name manifest.json 2>/dev/null)

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi
echo "OK: all repo-root manifests have build_dockerfile"
