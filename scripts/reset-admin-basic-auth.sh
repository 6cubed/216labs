#!/usr/bin/env bash
# Reset admin.6cubed.app HTTP Basic Auth on the droplet.
#
# Why: ADMIN_PASSWORD_HASH is not recoverable; this rotates it safely.
# - Generates a new random password (unless ADMIN_NEW_PASSWORD is set)
# - Hashes via caddy hash-password (run locally in Docker)
# - Writes ADMIN_USER + ADMIN_PASSWORD_HASH (+ ADMIN_PANEL_PASSWORD) into 216labs.db
# - Regenerates .env.admin and recreates caddy + admin containers
#
# Usage:
#   ./scripts/reset-admin-basic-auth.sh
#   ADMIN_USER=admin ADMIN_NEW_PASSWORD='your password' ./scripts/reset-admin-basic-auth.sh
#   POCKET_REMOTE=root@46.101.88.197 ./scripts/reset-admin-basic-auth.sh
set -euo pipefail

REMOTE="${POCKET_REMOTE:-root@46.101.88.197}"
ADMIN_USER="${ADMIN_USER:-admin}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is required locally to generate the Caddy hash." >&2
  exit 1
fi

if [[ -n "${ADMIN_NEW_PASSWORD:-}" ]]; then
  NEW_PASSWORD="${ADMIN_NEW_PASSWORD}"
else
  # 22 chars from a safe alphabet (no spaces); strong enough for basic auth.
  NEW_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(16))')"
fi

HASH="$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$NEW_PASSWORD")"
# bcrypt/argon hashes contain $ — never pass them through remote bash double-quotes (expands $2a$…).
HASH_B64="$(printf '%s' "$HASH" | base64 | tr -d '\n')"
PANEL_PW_B64="$(printf '%s' "$NEW_PASSWORD" | base64 | tr -d '\n')"

echo "==> Setting admin basic auth on $REMOTE"
ssh -o BatchMode=yes -o ConnectTimeout=25 "$REMOTE" bash -s -- "$ADMIN_USER" "$HASH_B64" "$PANEL_PW_B64" <<'REMOTE'
set -euo pipefail
ADMIN_USER="$1"
ADMIN_PASSWORD_HASH_B64="$2"
PANEL_PW_B64="$3"
DB="/opt/216labs/216labs.db"

python3 - "$DB" "$ADMIN_USER" "$ADMIN_PASSWORD_HASH_B64" "$PANEL_PW_B64" <<'PY'
import base64, sqlite3, sys

db_path, admin_user, admin_hash_b64, panel_pw_b64 = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
admin_hash = base64.b64decode(admin_hash_b64.encode("ascii")).decode("utf-8")
panel_pw = base64.b64decode(panel_pw_b64.encode("ascii")).decode("utf-8")
if not admin_hash.startswith("$"):
    raise SystemExit(f"invalid hash after decode (expected $… prefix, got {admin_hash[:8]!r})")

conn = sqlite3.connect(db_path)
conn.execute(
    "CREATE TABLE IF NOT EXISTS env_vars (key TEXT PRIMARY KEY, value TEXT, description TEXT, is_secret INTEGER, updated_at TEXT)"
)


def upsert(key: str, val: str, desc: str, secret: int) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO env_vars (key, value, description, is_secret, updated_at) VALUES (?, '', ?, ?, NULL)",
        (key, desc, secret),
    )
    conn.execute(
        "UPDATE env_vars SET value = ?, updated_at = datetime('now') WHERE key = ?",
        (val, key),
    )


upsert("ADMIN_USER", admin_user, "Admin dashboard basic auth username (admin.6cubed.app).", 0)
upsert("ADMIN_PASSWORD_HASH", admin_hash, "Caddy bcrypt/PHC hash for admin basic auth.", 1)
upsert("ADMIN_PANEL_PASSWORD", panel_pw, "Shared password for internal admin-panel cookie login.", 1)
conn.commit()
conn.close()
print("ok: updated ADMIN_USER, ADMIN_PASSWORD_HASH, ADMIN_PANEL_PASSWORD in env_vars")
PY

cd /opt/216labs
python3 scripts/export-env-admin-from-db.py 216labs.db > .env.admin

# Recreate caddy to pick up new env + auth hash; also restart admin + internal panels.
docker compose --env-file .env --env-file .env.admin up -d --pull never --no-build --force-recreate caddy admin difftinder >/dev/null 2>&1 || \
  docker compose --env-file .env --env-file .env.admin up -d --pull never --no-build --force-recreate caddy admin >/dev/null
echo "ok: recreated caddy + admin"
REMOTE

echo
echo "==> New admin login"
echo "URL: https://admin.6cubed.app/"
echo "User: $ADMIN_USER"
echo "Pass: $NEW_PASSWORD"
