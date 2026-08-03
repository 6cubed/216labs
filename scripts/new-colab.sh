#!/usr/bin/env bash
# new-colab.sh — scaffold a standalone Colab experiment under colabs/
#
# Usage:
#   ./scripts/new-colab.sh <experiment-id> ["One-line question"]
#
# Creates:
#   colabs/<id>/README.md
#   colabs/<id>/experiment.ipynb
# and appends a row to colabs/README.md index (if missing).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXP_ID="${1:-}"
QUESTION="${2:-TODO: one-line research / demo question}"

if [[ -z "$EXP_ID" ]]; then
  echo "Usage: ./scripts/new-colab.sh <experiment-id> [\"One-line question\"]" >&2
  echo "  experiment-id   kebab-case (e.g. carfac-vs-mel)" >&2
  exit 1
fi

# Allow leading underscore for private/template folders (e.g. _example).
if [[ ! "$EXP_ID" =~ ^_?[a-z0-9]+([_-][a-z0-9]+)*$ ]]; then
  echo "ERROR: experiment-id must be lowercase kebab-case (got: $EXP_ID)" >&2
  exit 1
fi

DIR="$ROOT/colabs/$EXP_ID"
if [[ -d "$DIR" ]]; then
  echo "ERROR: $DIR already exists" >&2
  exit 1
fi

mkdir -p "$DIR"
TITLE="$(echo "$EXP_ID" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1')"
COLAB_URL="https://colab.research.google.com/github/6cubed/216labs/blob/main/colabs/${EXP_ID}/experiment.ipynb"

cat > "$DIR/README.md" <<EOF
# ${TITLE}

**Question:** ${QUESTION}

**Status:** draft

## Run

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](${COLAB_URL})

## Notes

(What to look for when the notebook finishes.)
EOF

# Minimal valid notebook (same shape as colabs/_example)
python3 - "$DIR/experiment.ipynb" "$TITLE" "$QUESTION" <<'PY'
import json, sys
path, title, question = sys.argv[1], sys.argv[2], sys.argv[3]
nb = {
  "nbformat": 4,
  "nbformat_minor": 5,
  "metadata": {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "pygments_lexer": "ipython3"},
    "colab": {"provenance": [], "toc_visible": True},
  },
  "cells": [
    {
      "cell_type": "markdown",
      "metadata": {},
      "source": [
        f"# {title}\n",
        "\n",
        f"**Question:** {question}\n",
        "\n",
        "Standalone Colab under `colabs/` — keep installs in the next cell.\n",
      ],
    },
    {
      "cell_type": "code",
      "metadata": {},
      "source": [
        "# %pip install -q numpy matplotlib\n",
        "print(\"ok — replace with the experiment\")\n",
      ],
      "outputs": [],
      "execution_count": None,
    },
  ],
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=2)
    f.write("\n")
PY

INDEX="$ROOT/colabs/README.md"
ROW="| [\`${EXP_ID}/\`](${EXP_ID}/) | ${QUESTION} |"
if grep -q "\[\`${EXP_ID}/\`\]" "$INDEX" 2>/dev/null; then
  echo "==> Index already lists ${EXP_ID}"
else
  # Insert after the table header separator line under ## Index
  python3 - "$INDEX" "$ROW" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
row = sys.argv[2]
text = path.read_text()
marker = "|--------|----------|\n"
if marker not in text:
    raise SystemExit("colabs/README.md missing Index table marker")
# Insert after first marker (the Index table)
pre, post = text.split(marker, 1)
# Keep example row at bottom: insert new rows above _example if present
lines = post.splitlines(keepends=True)
out = []
inserted = False
for line in lines:
    if (not inserted) and ("_example/" in line or line.startswith("## ")):
        out.append(row + "\n")
        inserted = True
    out.append(line)
if not inserted:
    out.insert(0, row + "\n")
path.write_text(pre + marker + "".join(out))
PY
  echo "==> Added index row to colabs/README.md"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Scaffolded colabs/${EXP_ID}"
echo ""
echo "  Edit:  colabs/${EXP_ID}/experiment.ipynb"
echo "  Open:  ${COLAB_URL}"
echo ""
echo "  Commit when ready:"
echo "    git add colabs/${EXP_ID} colabs/README.md && git commit && git push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
