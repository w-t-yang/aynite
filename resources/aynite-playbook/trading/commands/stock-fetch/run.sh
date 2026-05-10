#!/usr/bin/env bash
# stock-fetch — Fetch stock data as JSON via yfinance
# Invoke with: > stock-fetch --symbol AAPL [--period 1d] [--output ./data]
#
# Always exits 0 so Aynite displays the JSON output (including errors).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/scripts/fetch.py"

# Run Python script; capture stdout+stderr. Ignore exit code.
OUTPUT=$(python3 "$PYTHON_SCRIPT" "$@" 2>&1) || true
echo "$OUTPUT"
