#!/usr/bin/env bash
# Ensure Pocket Cursor bridge venv exists, then start the local CDP bridge.
# Run from 216labs repo root.
# Usage: ./scripts/ensure-and-start-pocket-cursor.sh

set -e
REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null || true)"
POCKET_CURSOR_DIR="${POCKET_CURSOR_DIR:-$REPO_ROOT/internal/admin/pocket-cursor-bridge}"

echo "Pocket Cursor bridge directory: $POCKET_CURSOR_DIR"

if [[ ! -d "$POCKET_CURSOR_DIR" ]]; then
  echo "Expected bridge at: $POCKET_CURSOR_DIR"
  exit 1
fi

cd "$POCKET_CURSOR_DIR"

# Venv if missing
if [[ ! -d .venv ]]; then
  echo "Creating .venv and installing dependencies..."
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

# .env if missing
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Set TELEGRAM_BOT_TOKEN in: $POCKET_CURSOR_DIR/.env"
  echo "Then run this script again to start the bridge."
  exit 0
fi

# Kill existing bridge (Unix)
if command -v pkill &>/dev/null; then
  pkill -f 'pocket_cursor\.py' 2>/dev/null && echo "Stopped existing bridge." || true
elif command -v pgrep &>/dev/null; then
  pids=$(pgrep -f 'pocket_cursor\.py' 2>/dev/null) || true
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill 2>/dev/null && echo "Stopped existing bridge." || true
  fi
fi

# Remove stale lock
[[ -f .bridge.lock ]] && rm -f .bridge.lock

# Start bridge
echo "Starting Pocket Cursor bridge..."
exec .venv/bin/python -X utf8 pocket_cursor.py
