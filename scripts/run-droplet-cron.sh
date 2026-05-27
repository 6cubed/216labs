#!/usr/bin/env bash
# Run a cron-runner job immediately on the production droplet (POST /run/:id).
#
# Usage:
#   ./scripts/run-droplet-cron.sh difftinder-daily-idea
#   POCKET_REMOTE=root@46.101.88.197 ./scripts/run-droplet-cron.sh edge-visitor-rollup
set -euo pipefail

JOB_ID="${1:-}"
if [[ -z "$JOB_ID" ]]; then
  echo "Usage: $0 <cron-job-id>" >&2
  echo "Example: $0 difftinder-daily-idea" >&2
  exit 1
fi

REMOTE="${POCKET_REMOTE:-root@46.101.88.197}"
REMOTE_DB="${POCKET_REMOTE_DB:-/opt/216labs/216labs.db}"
CRON_URL="${CRON_RUNNER_INTERNAL_URL:-http://127.0.0.1:3029}"

ssh -o BatchMode=yes -o ConnectTimeout=25 "$REMOTE" bash -s -- "$REMOTE_DB" "$JOB_ID" "$CRON_URL" <<'REMOTE'
set -euo pipefail
DB="$1"
JOB_ID="$2"
CRON_URL="$3"
SECRET="$(python3 -c "
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
row = c.execute(
    \"SELECT value FROM env_vars WHERE key = 'CRON_RUNNER_SECRET' AND trim(value) != ''\"
).fetchone()
if not row:
    raise SystemExit('CRON_RUNNER_SECRET missing in env_vars')
print(row[0].strip())
" "$DB")"
BODY="$(docker exec 216labs-cron-runner-1 wget -qO- \
  --method=POST \
  --header="Authorization: Bearer ${SECRET}" \
  "${CRON_URL}/run/${JOB_ID}" 2>&1)" || {
  echo "cron POST failed: $BODY" >&2
  exit 1
}
echo "$BODY"
REMOTE
