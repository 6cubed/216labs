#!/usr/bin/env bash
# Copy minimal deploy-bootstrap + deploy-priority from config/examples/toolkit-starter.
# Use when preparing a greenfield or community starter fork. Review before commit.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EX="$ROOT/config/examples/toolkit-starter"
cp "$EX/deploy-bootstrap.txt" "$ROOT/config/deploy-bootstrap.txt"
cp "$EX/deploy-priority.txt" "$ROOT/config/deploy-priority.txt"
echo "Copied toolkit starter config into config/. Edit if needed, then commit."
