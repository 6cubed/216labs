#!/usr/bin/env bash
# Create an isolated Pocket Cursor bridge instance (separate bot token + state + CDP port).
# Usage: ./scripts/spawn-pocket-bridge.sh <instance-id>
# Then edit internal/admin/pocket-cursor-bridge-instances/<id>/.env and start with POCKET_BRIDGE_DATA_DIR=...
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ID="${1:-}"

if [[ -z "$ID" || ! "$ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$ ]]; then
  echo "Usage: $0 <instance-id>   (e.g. studio, mac-mini, jack-laptop)" >&2
  exit 1
fi

INST_ROOT="$ROOT/internal/admin/pocket-cursor-bridge-instances"
INST_DIR="$INST_ROOT/$ID"
CODE_DIR="$ROOT/internal/admin/pocket-cursor-bridge"

if [[ -d "$INST_DIR" ]]; then
  echo "Instance already exists: $INST_DIR" >&2
  exit 1
fi

mkdir -p "$INST_DIR"
# Stable CDP port offset from instance name (9223–9271).
HASH=$(printf '%s' "$ID" | cksum | awk '{print $1}')
PORT=$((9223 + HASH % 49))

cat >"$INST_DIR/.env" <<EOF
# Pocket bridge instance: $ID
# REQUIRED: create a dedicated bot via @BotFather — do not reuse another bridge's token.
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_ID=
# TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

POCKET_BRIDGE_INSTANCE_ID=$ID
POCKET_CDP_PORT=$PORT

# Optional: pin this bridge to one group (negative id for supergroups)
# POCKETCURSOR_BRIDGE_CHAT_ID=
EOF

cat >"$INST_DIR/README.txt" <<EOF
Instance: $ID
Start from repo root:

  POCKET_BRIDGE_DATA_DIR=internal/admin/pocket-cursor-bridge-instances/$ID \\
    ./scripts/pocket-cursor-bridge.sh

Docs: internal/admin/pocket-cursor-bridge/BRIDGE-FEDERATION.md
EOF

echo "Created bridge instance: $INST_DIR"
echo "  POCKET_CDP_PORT=$PORT"
echo ""
echo "Next:"
echo "  1. @BotFather → new bot → paste TELEGRAM_BOT_TOKEN into $INST_DIR/.env"
echo "  2. Add that bot to your Telegram group (same group as other bridges is OK)"
echo "  3. Set TELEGRAM_OWNER_ID / TELEGRAM_ALLOWED_USER_IDS"
echo "  4. POCKET_BRIDGE_DATA_DIR=internal/admin/pocket-cursor-bridge-instances/$ID ./scripts/pocket-cursor-bridge.sh"
