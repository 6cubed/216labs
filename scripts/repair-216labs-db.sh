#!/usr/bin/env bash
# Restore 216labs.db from the newest deploy backup when PRAGMA quick_check fails.
# Run on the droplet from the repo root: ./scripts/repair-216labs-db.sh [/opt/216labs]
set -euo pipefail

ROOT="${1:-/opt/216labs}"
cd "$ROOT"
DB="216labs.db"

if [[ ! -f "$DB" ]]; then
  echo "No $DB in $ROOT" >&2
  exit 1
fi

check() {
  sqlite3 "$DB" 'PRAGMA quick_check;' 2>/dev/null | head -1
}

status="$(check || true)"
if [[ "$status" == "ok" ]]; then
  echo "216labs.db quick_check: ok"
  exit 0
fi

echo "216labs.db quick_check failed: ${status:-unknown error}"
stamp="$(date +%Y%m%d%H%M)"
cp -a "$DB" "${DB}.corrupt.${stamp}"

latest="$(ls -t 216labs.db.bak.* 2>/dev/null | head -1 || true)"
if [[ -z "$latest" ]]; then
  echo "No 216labs.db.bak.* backup found. Try: sqlite3 $DB .recover > recovered.sql" >&2
  exit 1
fi

echo "Restoring from $latest"
cp -a "$latest" "$DB"
status="$(check || true)"
if [[ "$status" == "ok" ]]; then
  echo "Restored DB quick_check: ok — restart activator and admin: docker compose up -d activator admin"
  exit 0
fi

echo "Backup also failed quick_check: $status" >&2
exit 1
