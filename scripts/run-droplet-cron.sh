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

ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=25 \
  -o StrictHostKeyChecking=accept-new \
  "$REMOTE" bash -s -- "$REMOTE_DB" "$JOB_ID" "$CRON_URL" <<'REMOTE'
set -euo pipefail
DB="$1"
JOB_ID="$2"
CRON_URL="$3"
SECRET="$(python3 -c "
import sqlite3, sys
db = sys.argv[1]
c = sqlite3.connect(db)
row = c.execute(
    \"SELECT value FROM env_vars WHERE key = 'CRON_RUNNER_SECRET' AND trim(value) != ''\"
).fetchone()
if row:
    print(row[0].strip())
    raise SystemExit(0)
" "$DB" 2>/dev/null || true)"
if [ -z "${SECRET:-}" ]; then
  SECRET="$(docker exec 216labs-cron-runner-1 printenv CRON_RUNNER_SECRET 2>/dev/null | tr -d '\r' || true)"
fi
if [ -z "${SECRET:-}" ] && [ -f /opt/216labs/.env.admin ]; then
  SECRET="$(grep -E '^CRON_RUNNER_SECRET=' /opt/216labs/.env.admin | head -1 | cut -d= -f2- | tr -d '\r' || true)"
fi
if [ -z "${SECRET:-}" ]; then
  echo "CRON_RUNNER_SECRET missing — run: ./scripts/ensure-droplet-cron-secret.sh" >&2
  exit 1
fi
AUTH_HEADER="Authorization: Bearer ${SECRET}"
BODY="$(docker exec 216labs-cron-runner-1 node -e '
const job = process.argv[1];
const base = String(process.argv[2] || "").replace(/\/$/, "");
const secret = process.argv[3] || "";
const headers = {};
if (secret) headers.Authorization = `Bearer ${secret}`;
fetch(`${base}/run/${job}`, {
  method: "POST",
  headers,
})
  .then(async (r) => {
    const t = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${t}`);
    console.log(t);
  })
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
' "$JOB_ID" "$CRON_URL" "$SECRET")"
echo "$BODY"
REMOTE
