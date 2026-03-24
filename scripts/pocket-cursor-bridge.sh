#!/usr/bin/env bash
# Single entry: venv, deps, Cursor+CDP, then pocket_cursor.py. Run from repo root:
#   ./scripts/pocket-cursor-bridge.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BRIDGE="$ROOT/internal/admin/pocket-cursor-bridge"
if [[ ! -d "$BRIDGE" ]]; then
  echo "Expected bridge at $BRIDGE"
  exit 1
fi
cd "$BRIDGE"
PY="${BRIDGE}/.venv/bin/python"
PIP="${BRIDGE}/.venv/bin/pip"

if [[ ! -x "$PY" ]]; then
  python3 -m venv .venv
fi
"$PY" -m pip install -q --upgrade pip setuptools wheel
"$PIP" install -q -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env — set TELEGRAM_BOT_TOKEN, then run this script again."
  exit 1
fi

pkill -f 'pocket_cursor\.py' 2>/dev/null || true
rm -f .bridge.lock

"$PY" -X utf8 start_cursor.py
exec "$PY" -X utf8 pocket_cursor.py
