#!/usr/bin/env bash
# Wait for Cursor CDP, then start pocket_cursor.py (used when Cursor was started without CDP).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE="$ROOT/internal/admin/pocket-cursor-bridge"
cd "$BRIDGE"
PY="$BRIDGE/.venv/bin/python"
PORT="${POCKET_CDP_PORT:-9222}"

echo "[pocket-bridge-wait] Waiting for CDP on :${PORT}…"
for _ in $(seq 1 180); do
  if curl -sf -m 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    echo "[pocket-bridge-wait] CDP up — starting bridge"
    exec "$PY" -X utf8 pocket_cursor.py
  fi
  sleep 2
done
echo "[pocket-bridge-wait] Timed out (6 min). Quit Cursor (Cmd+Q), reopen, then run ./scripts/pocket-cursor-bridge.sh"
exit 1
