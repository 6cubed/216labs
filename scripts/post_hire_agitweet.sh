#!/usr/bin/env bash
# Publish the hire blurb to agitweet.6cubed.app (no landing/Telegram restyle).
# Token stays on the droplet (sqlite → stdin into the container). Never printed.
set -euo pipefail
REMOTE="${1:-${POCKET_REMOTE:-root@46.101.88.197}}"

ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=20 \
  -o ServerAliveInterval=5 \
  -o StrictHostKeyChecking=accept-new \
  "$REMOTE" python3 - <<'PY'
import json, sqlite3, subprocess, sys

text = (
    "216Labs takes paid work: production web apps, AI retainers "
    "(€5–15k / monthly), CARFAC audio/ML pilots.\n"
    "Hire: https://6cubed.app/#work\n"
    "Proof: https://blog.6cubed.app/blog/carfac-underwater-sai"
)

subprocess.run(
    ["bash", "-lc", """
set -euo pipefail
cd /opt/216labs
if ! docker image inspect 216labs/agitweet:latest >/dev/null 2>&1; then
  echo "==> pulling ghcr.io/6cubed/216labs/agitweet:latest"
  docker pull ghcr.io/6cubed/216labs/agitweet:latest
  docker tag ghcr.io/6cubed/216labs/agitweet:latest 216labs/agitweet:latest
fi
python3 scripts/export-env-admin-from-db.py 216labs.db > .env.admin
docker compose --env-file .env --env-file .env.admin up -d --pull never --no-build --force-recreate agitweet
ok=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if docker compose exec -T agitweet python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/healthz', timeout=2).read()" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
test "$ok" = 1
"""],
    check=True,
)

inner = r"""
import json, sys, urllib.error, urllib.request
token = sys.stdin.readline().rstrip("\n")
payload = sys.stdin.read().encode("utf-8")
req = urllib.request.Request(
    "http://127.0.0.1:5000/api/posts",
    data=payload,
    method="POST",
    headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = json.loads(resp.read().decode("utf-8", errors="replace"))
except urllib.error.HTTPError as e:
    sys.stderr.write("http_%s\n" % e.code)
    sys.exit(1)
print("posted id=%s ok=%s" % (body.get("id"), body.get("ok")))
"""

db = sqlite3.connect("/opt/216labs/216labs.db")
row = db.execute(
    "SELECT value FROM env_vars WHERE key='AGITWEET_API_TOKEN' AND trim(value)!=''"
).fetchone()
if not row:
    sys.exit("no AGITWEET_API_TOKEN in db")
proc = subprocess.run(
    ["docker", "compose", "exec", "-T", "agitweet", "python3", "-c", inner],
    input=str(row[0]).strip() + "\n" + json.dumps({"text": text}),
    cwd="/opt/216labs",
    capture_output=True,
    text=True,
)
sys.stdout.write(proc.stdout)
if proc.returncode:
    sys.stderr.write((proc.stderr or "exec failed")[-400:] + "\n")
    sys.exit(proc.returncode)
PY
