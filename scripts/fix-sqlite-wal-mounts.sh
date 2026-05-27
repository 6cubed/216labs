#!/usr/bin/env bash
# Fix 216labs.db Docker mount issues:
# - Remove 216labs.db-wal / 216labs.db-shm when they are directories (bind-mount bug)
# - Set journal_mode=DELETE (single-file DB; compose no longer mounts -wal/-shm)
# Usage: ./scripts/fix-sqlite-wal-mounts.sh [user@host]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-}"

run_fix() {
  local db="216labs.db"
  if [[ ! -f "$db" ]]; then
    echo "No $db in $(pwd)" >&2
    exit 1
  fi
  echo "Stopping services that bind-mount the DB..."
  docker compose stop admin activator cron-runner 2>/dev/null || true
  for sidecar in "${db}-wal" "${db}-shm"; do
    if [[ -d "$sidecar" ]] || [[ -f "$sidecar" ]]; then
      echo "Removing $sidecar"
      rm -rf "$sidecar"
    fi
  done
  if ! command -v sqlite3 &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq sqlite3
  fi
  mode="$(sqlite3 "$db" 'PRAGMA journal_mode=DELETE;')"
  echo "journal_mode=$mode"
  qc="$(sqlite3 "$db" 'PRAGMA quick_check;' | head -1)"
  echo "quick_check: $qc"
  if [[ "$qc" != "ok" ]]; then
    echo "DB not ok — run ./scripts/repair-216labs-db.sh" >&2
    exit 1
  fi
  echo "OK — docker compose up -d activator admin cron-runner"
}

if [[ -n "$REMOTE" ]]; then
  # shellcheck source=lib/ssh-retry.sh
  source "$ROOT/scripts/lib/ssh-retry.sh"
  ssh_with_retry "$REMOTE" "cd /opt/216labs && bash -s" <<'REMOTE'
set -euo pipefail
# inlined from run_fix (remote has no script until git pull)
db="216labs.db"
/usr/bin/timeout 120 docker compose stop admin activator cron-runner 2>/dev/null || true
for sidecar in "${db}-wal" "${db}-shm"; do
  [[ -e "$sidecar" ]] && rm -rf "$sidecar"
done
command -v sqlite3 &>/dev/null || { apt-get update -qq && apt-get install -y -qq sqlite3; }
mode="$(sqlite3 "$db" 'PRAGMA journal_mode=DELETE;')"
echo "journal_mode=$mode"
qc="$(sqlite3 "$db" 'PRAGMA quick_check;' | head -1)"
echo "quick_check: $qc"
[[ "$qc" == "ok" ]] || { echo "Run repair-216labs-db.sh" >&2; exit 1; }
REMOTE
  exit $?
fi

cd "$ROOT"
run_fix
