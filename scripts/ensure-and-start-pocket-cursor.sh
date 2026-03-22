#!/usr/bin/env bash
# Ensure Pocket Cursor bridge exists (clone + venv + .env if needed), then start it.
# Run from 216labs repo; bridge runs from sibling directory pocket-cursor.
# Usage: ./scripts/ensure-and-start-pocket-cursor.sh

set -e
REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null || true)"
# Put pocket-cursor next to the repo's parent folder (e.g. .../projects/pocket-cursor with .../projects/216labs)
PARENT="$(dirname "$(dirname "$REPO_ROOT")")"
POCKET_CURSOR_DIR="${POCKET_CURSOR_DIR:-$PARENT/pocket-cursor}"
CLONE_URL="${POCKET_CURSOR_CLONE_URL:-https://github.com/qmHecker/pocket-cursor.git}"

echo "Pocket Cursor bridge directory: $POCKET_CURSOR_DIR"

# 1. Clone if missing
if [[ ! -d "$POCKET_CURSOR_DIR" ]]; then
  echo "Cloning pocket-cursor..."
  git clone "$CLONE_URL" "$POCKET_CURSOR_DIR"
fi

cd "$POCKET_CURSOR_DIR"

# 2. Venv if missing
if [[ ! -d .venv ]]; then
  echo "Creating .venv and installing dependencies..."
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

# 3. .env if missing
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Set TELEGRAM_BOT_TOKEN in: $POCKET_CURSOR_DIR/.env"
  echo "Then run this script again to start the bridge."
  exit 0
fi

# 4. Kill existing bridge (Unix)
if command -v pkill &>/dev/null; then
  pkill -f 'pocket_cursor\.py' 2>/dev/null && echo "Stopped existing bridge." || true
elif command -v pgrep &>/dev/null; then
  pids=$(pgrep -f 'pocket_cursor\.py' 2>/dev/null) || true
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null && echo "Stopped existing bridge." || true
  fi
fi

# 5. Remove stale lock
[[ -f .bridge.lock ]] && rm -f .bridge.lock

# 6. Start bridge
echo "Starting Pocket Cursor bridge..."
exec .venv/bin/python -X utf8 pocket_cursor.py
