#!/usr/bin/env bash
# Restore 216labs.db when PRAGMA quick_check fails (malformed disk image, etc.).
# Run on the droplet: ./scripts/repair-216labs-db.sh [/opt/216labs]
set -euo pipefail

ROOT="${1:-/opt/216labs}"
cd "$ROOT"
DB="216labs.db"
SQLITE_IMAGE="${SQLITE_IMAGE:-keinos/sqlite3:latest}"

if [[ ! -f "$DB" ]]; then
  echo "No $DB in $ROOT" >&2
  exit 1
fi

sqlite_run() {
  local sql="$1"
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB" "$sql"
    return
  fi
  docker run --rm -v "$ROOT:/data:rw" "$SQLITE_IMAGE" sqlite3 "/data/$DB" "$sql"
}

quick_check() {
  sqlite_run 'PRAGMA quick_check;' 2>/dev/null | head -1 || true
}

try_wal_checkpoint() {
  echo "Attempting WAL checkpoint on $DB ..."
  rm -f "${DB}-wal" "${DB}-shm" 2>/dev/null || true
  sqlite_run 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null 2>&1 || true
}

status="$(quick_check)"
if [[ "$status" == "ok" ]]; then
  echo "216labs.db quick_check: ok"
  exit 0
fi

echo "216labs.db quick_check failed: ${status:-unknown error}"
try_wal_checkpoint
status="$(quick_check)"
if [[ "$status" == "ok" ]]; then
  echo "216labs.db quick_check: ok (after WAL checkpoint)"
  exit 0
fi

stamp="$(date +%Y%m%d%H%M)"
cp -a "$DB" "${DB}.corrupt.${stamp}"
rm -f "${DB}-wal" "${DB}-shm" 2>/dev/null || true

mapfile -t backups < <(ls -t 216labs.db.bak.* 2>/dev/null || true)
if [[ ${#backups[@]} -eq 0 ]]; then
  echo "No 216labs.db.bak.* backup found." >&2
  exit 1
fi

for bak in "${backups[@]}"; do
  echo "Trying restore from $bak ..."
  cp -a "$bak" "$DB"
  rm -f "${DB}-wal" "${DB}-shm" 2>/dev/null || true
  status="$(quick_check)"
  if [[ "$status" == "ok" ]]; then
    echo "Restored DB quick_check: ok (from $bak)"
    echo "Restart: docker compose --env-file .env --env-file .env.admin up -d activator admin"
    exit 0
  fi
  echo "  backup failed: ${status:-unknown}"
done

echo "All backups failed quick_check. Inspect ${DB}.corrupt.${stamp} manually." >&2
exit 1
