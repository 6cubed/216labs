#!/usr/bin/env bash
# Back-compat wrapper — prefer ./scripts/bootstrap-toolkit.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/bootstrap-toolkit.sh" "$@"
