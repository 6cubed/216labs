#!/usr/bin/env bash
# Ensure CRON_RUNNER_SECRET exists in 216labs.db and cron-runner picks it up.
# Usage: ./scripts/ensure-droplet-cron-secret.sh [user@host]
set -euo pipefail

REMOTE="${1:-root@46.101.88.197}"

ssh -o BatchMode=yes -o ConnectTimeout=25 -o StrictHostKeyChecking=accept-new "$REMOTE" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/216labs
if [ ! -f 216labs.db ]; then
  echo "ERROR: /opt/216labs/216labs.db missing" >&2
  exit 1
fi
if [ -f scripts/bootstrap-internal-panel-env.py ]; then
  python3 scripts/bootstrap-internal-panel-env.py 216labs.db
else
  echo "ERROR: bootstrap-internal-panel-env.py missing (git pull?)" >&2
  exit 1
fi
: > .env.admin
python3 scripts/export-env-admin-from-db.py 216labs.db > .env.admin
echo "==> .env.admin lines: $(wc -l < .env.admin | tr -d ' ')"
if grep -q '^CRON_RUNNER_SECRET=' .env.admin; then
  echo "==> CRON_RUNNER_SECRET present in .env.admin"
else
  echo "WARNING: CRON_RUNNER_SECRET still missing after bootstrap" >&2
  exit 1
fi
docker compose --env-file .env --env-file .env.admin up -d --pull never --no-build cron-runner
echo "==> cron-runner recreated with secret from DB"
REMOTE
