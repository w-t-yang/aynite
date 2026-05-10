#!/usr/bin/env bash
# stock-view — Generate interactive HTML chart from stock JSON
# Invoke with: > stock-view --file ~/aynite-data/AAPL.json
#
# Always exits 0 so Aynite displays the JSON output.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/scripts/generate.py"

OUTPUT=$(python3 "$PYTHON_SCRIPT" "$@" 2>&1) || true
echo "$OUTPUT"
