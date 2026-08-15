#!/usr/bin/env bash
# Publish the hire blurb to agitweet.6cubed.app (no landing/Telegram restyle).
# Token is read inside the agitweet container; it is never printed.
set -euo pipefail
REMOTE="${1:-${POCKET_REMOTE:-root@46.101.88.197}}"

ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=20 \
  -o ServerAliveInterval=5 \
  -o StrictHostKeyChecking=accept-new \
  "$REMOTE" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/216labs
if ! docker image inspect 216labs/agitweet:latest >/dev/null 2>&1; then
  echo "==> pulling ghcr.io/6cubed/216labs/agitweet:latest"
  docker pull ghcr.io/6cubed/216labs/agitweet:latest
  docker tag ghcr.io/6cubed/216labs/agitweet:latest 216labs/agitweet:latest
fi
docker compose --env-file .env --env-file .env.admin up -d --pull never --no-build agitweet
ok=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if docker compose exec -T agitweet python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/healthz', timeout=2).read()" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" != 1 ]; then
  echo "agitweet did not become healthy" >&2
  exit 1
fi
docker compose exec -T agitweet python3 -c '
import json, os, urllib.error, urllib.request
text = (
    "216Labs takes paid work: production web apps, AI retainers "
    "(€5–15k / monthly), CARFAC audio/ML pilots.\n"
    "Hire: https://6cubed.app/#work\n"
    "Proof: https://blog.6cubed.app/blog/carfac-underwater-sai"
)
token = (os.environ.get("AGITWEET_API_TOKEN") or "").strip()
if not token:
    raise SystemExit("AGITWEET_API_TOKEN missing in agitweet container")
req = urllib.request.Request(
    "http://127.0.0.1:5000/api/posts",
    data=json.dumps({"text": text}).encode("utf-8"),
    method="POST",
    headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = json.loads(resp.read().decode("utf-8", errors="replace"))
except urllib.error.HTTPError as e:
    err = (e.read() or b"").decode("utf-8", errors="replace")[:180]
    raise SystemExit("http_%s:%s" % (e.code, err))
print("posted id=%s ok=%s" % (body.get("id"), body.get("ok")))
'
REMOTE
