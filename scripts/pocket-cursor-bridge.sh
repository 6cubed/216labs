#!/usr/bin/env bash
# Single entry: venv, deps, Cursor+CDP, then pocket_cursor.py. Run from repo root:
#   ./scripts/pocket-cursor-bridge.sh
#
# Telegram: if no TELEGRAM_BOT_TOKEN (env / .env.admin-sync / .env), an interactive wizard runs.
#   POCKET_SKIP_WIZARD=1  — skip wizard; fail fast like the old behavior (for CI / no TTY).
#   POCKET_WIZARD=1       — force the wizard even when a token is already configured.
#
# Needs Python 3.10+ (default `python3` on older Macs may be 3.7 and WILL fail to
# install deps). Install: brew install python@3.12  OR set POCKETCURSOR_PYTHON to a 3.10+ binary.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE="$ROOT/internal/admin/pocket-cursor-bridge"
if [[ ! -d "$BRIDGE" ]]; then
  echo "Expected bridge at $BRIDGE"
  exit 1
fi
cd "$BRIDGE"

# Optional: pull TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_ID from droplet admin DB (after setting them in admin UI).
if [[ "${POCKET_SYNC_FROM_ADMIN:-}" == "1" ]]; then
  SYNC_SCRIPT="$ROOT/scripts/sync-pocket-bridge-env.sh"
  if [[ -x "$SYNC_SCRIPT" ]]; then
    "$SYNC_SCRIPT" || echo "[pocket-cursor-bridge] sync-pocket-bridge-env.sh failed (continuing with existing env files)"
  else
    bash "$SYNC_SCRIPT" || echo "[pocket-cursor-bridge] sync failed"
  fi
fi

resolve_python() {
  local c
  for c in "${POCKETCURSOR_PYTHON:-}" python3.13 python3.12 python3.11 python3.10 python3; do
    [[ -z "${c:-}" ]] && continue
    if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      printf '%s' "$c"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="$(resolve_python || true)"
if [[ -z "${PYTHON_BIN:-}" ]]; then
  echo "PocketCursor bridge needs Python 3.10 or newer. Your default python3 may be too old (e.g. 3.7)."
  echo "Install one of: brew install python@3.12"
  echo "Then run again, or set: export POCKETCURSOR_PYTHON=/opt/homebrew/bin/python3.12"
  exit 1
fi

PY="${BRIDGE}/.venv/bin/python"
PIP="${BRIDGE}/.venv/bin/pip"

if [[ ! -x "$PY" ]]; then
  echo "Using Python: $($PYTHON_BIN --version 2>&1) ($PYTHON_BIN)"
  "$PYTHON_BIN" -m venv .venv
fi

# Recreate venv if it was built with an older interpreter (e.g. upgraded from 3.7 to Homebrew 3.12)
if [[ -x "$PY" ]] && ! "$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
  echo "Replacing .venv (previous Python was < 3.10)..."
  rm -rf .venv
  "$PYTHON_BIN" -m venv .venv
fi

"$PY" -m pip install -q --upgrade pip setuptools wheel
"$PIP" install -q -r requirements.txt

# Token: exported env, or .env.admin-sync / .env (merged in pocket_cursor.py; export wins).
# Interactive wizard writes .env when nothing provides a token (unless POCKET_SKIP_WIZARD=1).
if [[ "${POCKET_SKIP_WIZARD:-}" == "1" ]]; then
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" && ! -f .env && ! -f .env.admin-sync ]]; then
    echo "TELEGRAM_BOT_TOKEN not set. Either:"
    echo "  export TELEGRAM_BOT_TOKEN='…'"
    echo "  or run: POCKET_SYNC_FROM_ADMIN=1 $0   (after setting token in admin + SSH to droplet)"
    echo "  or create .env / .env.admin-sync (see .env.example)"
    echo "  or omit POCKET_SKIP_WIZARD to run the setup wizard."
    exit 1
  fi
else
  "$PY" -X utf8 bridge_wizard.py --ensure || exit 1
fi

pkill -f 'pocket_cursor\.py' 2>/dev/null || true
rm -f .bridge.lock

"$PY" -X utf8 start_cursor.py
exec "$PY" -X utf8 pocket_cursor.py
