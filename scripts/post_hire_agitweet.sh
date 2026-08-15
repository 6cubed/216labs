#!/usr/bin/env bash
# Publish the hire blurb to agitweet.6cubed.app (no landing/Telegram restyle).
# Token stays on the droplet (sqlite → stdin into the container). Never printed.
# Idempotent: if the volume DB already has 6cubed.app/#work, exit 0 without
# starting or recreating the container. A public 302 to activator is "cold",
# not "missing hire" — urllib follows redirects and would otherwise wake it.
set -euo pipefail
REMOTE="${1:-${POCKET_REMOTE:-root@46.101.88.197}}"

already=$(
  python3 - <<'PY' || true
import json, sys, urllib.error, urllib.request

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

url = "https://agitweet.6cubed.app/api/posts?limit=5"
try:
    opener = urllib.request.build_opener(_NoRedirect)
    with opener.open(url, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8", errors="replace"))
except urllib.error.HTTPError as e:
    loc = (e.headers.get("Location") or "") if e.headers else ""
    if e.code in (301, 302, 303, 307, 308) and ("activator" in loc or "warmup" in loc):
        sys.exit(0)
    sys.exit(0)
except Exception:
    sys.exit(0)
for post in (data.get("posts") or [])[:5]:
    if "6cubed.app/#work" in (post.get("text") or ""):
        print("already posted id=%s" % post.get("id"))
        sys.exit(0)
sys.exit(0)
PY
)
if [[ "$already" == already\ posted* ]]; then
  echo "$already"
  exit 0
fi

ssh \
  -o BatchMode=yes \
  -o ConnectTimeout=20 \
  -o ServerAliveInterval=5 \
  -o StrictHostKeyChecking=accept-new \
  "$REMOTE" python3 - <<'PY'
import json, os, sqlite3, subprocess, sys

text = (
    "216Labs takes paid work: production web apps, AI retainers "
    "(€5–15k / monthly), CARFAC audio/ML pilots.\n"
    "Hire: https://6cubed.app/#work\n"
    "Proof: https://blog.6cubed.app/blog/carfac-underwater-sai"
)
hire_mark = "6cubed.app/#work"
volume_db = "/opt/216labs/products/org-social/agitweet/data/agitweet.db"


def _hire_in_volume():
    if not os.path.isfile(volume_db):
        return None
    try:
        con = sqlite3.connect(volume_db)
        row = con.execute(
            "SELECT id FROM posts WHERE instr(text, ?) > 0 ORDER BY id DESC LIMIT 1",
            (hire_mark,),
        ).fetchone()
        con.close()
        return row[0] if row else None
    except sqlite3.Error:
        return None


existing = _hire_in_volume()
if existing is not None:
    print("already posted id=%s (volume; not starting agitweet)" % existing)
    sys.exit(0)


def _run(args, **kw):
    return subprocess.run(args, cwd="/opt/216labs", **kw)


def _healthy():
    r = _run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "agitweet",
            "python3",
            "-c",
            "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/healthz', timeout=2).read()",
        ],
        capture_output=True,
    )
    return r.returncode == 0


def _token_in_container():
    r = _run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "agitweet",
            "python3",
            "-c",
            "import os; print('1' if os.environ.get('AGITWEET_API_TOKEN','').strip() else '0')",
        ],
        capture_output=True,
        text=True,
    )
    return r.returncode == 0 and (r.stdout or "").strip() == "1"


if not _healthy():
    print("agitweet cold and no hire in volume; will not wake the container this beat")
    sys.exit(0)

if _run(["docker", "image", "inspect", "216labs/agitweet:latest"], capture_output=True).returncode != 0:
    print("==> pulling ghcr.io/6cubed/216labs/agitweet:latest", flush=True)
    _run(["docker", "pull", "ghcr.io/6cubed/216labs/agitweet:latest"], check=True)
    _run(["docker", "tag", "ghcr.io/6cubed/216labs/agitweet:latest", "216labs/agitweet:latest"], check=True)

if not _token_in_container():
    print("==> recreating agitweet so the API token is in the container", flush=True)
    _run(
        ["bash", "-lc", "python3 scripts/export-env-admin-from-db.py 216labs.db > .env.admin"],
        check=True,
    )
    _run(
        [
            "docker",
            "compose",
            "--env-file",
            ".env",
            "--env-file",
            ".env.admin",
            "up",
            "-d",
            "--pull",
            "never",
            "--no-build",
            "--force-recreate",
            "agitweet",
        ],
        check=True,
    )
    import time

    ok = False
    for _ in range(12):
        if _healthy():
            ok = True
            break
        time.sleep(2)
    if not ok:
        sys.exit("agitweet did not become healthy")

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
