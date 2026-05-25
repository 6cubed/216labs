#!/usr/bin/env bash
# Regenerate .env.admin from 216labs.db and recreate paid-app containers (after Stripe keys in admin Env).
# Usage: ./scripts/apply-revenue-env-on-droplet.sh [user@host] [storybook|1pageresearch|merch|all]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-root@46.101.88.197}"
TARGET="${2:-storybook}"

ssh -o ConnectTimeout=25 -o BatchMode=yes "$REMOTE" "set -euo pipefail
cd /opt/216labs
if [[ ! -f 216labs.db ]]; then
  echo 'ERROR: /opt/216labs/216labs.db missing' >&2
  exit 1
fi
python3 scripts/export-env-admin-from-db.py 216labs.db > .env.admin
lines=\$(wc -l < .env.admin | tr -d ' ')
echo \"Wrote .env.admin (\${lines} lines)\"
recreate() {
  local svc=\"\$1\"
  echo \"==> Recreating \$svc\"
  docker compose --env-file .env --env-file .env.admin up -d --no-build --force-recreate \"\$svc\"
}
case \"${TARGET}\" in
  storybook) recreate storybook ;;
  1pageresearch) recreate 1pageresearch ;;
  merch) recreate merch ;;
  all) recreate storybook; recreate 1pageresearch; recreate merch ;;
  *) echo \"Unknown target: ${TARGET}\" >&2; exit 1 ;;
esac
echo \"==> Checkout probe:\"
curl -fsS -m 10 https://storybook.6cubed.app/api/checkout/ready 2>/dev/null | head -c 400 || true
echo
"

echo
"$ROOT/scripts/check-revenue-env-http.sh" 2>/dev/null || true
