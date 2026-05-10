#!/usr/bin/env python3
"""
Generate an interactive HTML stock chart from a stock-data JSON file.
Always exits with code 0 for Aynite compatibility.
"""

import sys
import json
import os
import shutil
from datetime import datetime, timezone


# ── Argument parsing ──────────────────────────────────────────
def parse_args(argv):
    args = {}
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg.startswith("--"):
            if "=" in arg:
                key, val = arg[2:].split("=", 1)
                args[key] = val
            else:
                key = arg[2:]
                if i + 1 < len(argv) and not argv[i + 1].startswith("--"):
                    i += 1
                    args[key] = argv[i]
                else:
                    args[key] = True
        i += 1
    return args


def usage():
    return {
        "status": "error",
        "error": "Missing required parameter: --file",
        "usage": {
            "description": "Generate an interactive HTML chart from a stock-data JSON file.",
            "syntax": "> stock-view --file <path/to/STOCK.json>",
            "required": [
                {"name": "--file", "description": "Path to a stock-data JSON file (produced by stock-fetch)"}
            ],
            "examples": [
                "> stock-view --file ~/aynite-data/AAPL.json",
                "> stock-view --file ./data/GOOGL.json"
            ]
        }
    }


# ── Validation ────────────────────────────────────────────────
def validate_stock_json(filepath: str):
    """Check that the JSON file is valid stock data format."""
    try:
        with open(filepath) as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        return False, str(e), None

    # Required structure: history array with OHLCV records
    history = data.get("history")
    if not isinstance(history, list) or len(history) == 0:
        return False, "Missing or empty 'history' array — not a valid stock data file.", None

    first = history[0]
    required_fields = ["date", "open", "high", "low", "close", "volume"]
    missing = [f for f in required_fields if f not in first]
    if missing:
        return False, f"History records missing fields: {missing}. Not a valid stock data file.", None

    symbol = (data.get("metadata", {}).get("symbol") or
              data.get("info", {}).get("symbol") or
              os.path.splitext(os.path.basename(filepath))[0].upper())

    return True, None, {"data": data, "symbol": symbol}


# ── Asset copying ─────────────────────────────────────────────
def copy_assets(assets_dir: str, target_dir: str):
    """Copy asset files to target directory, skipping existing files."""
    copied = []
    for fname in os.listdir(assets_dir):
        if fname == 'template.html':
            continue  # template is source-only, not copied to output
        src = os.path.join(assets_dir, fname)
        dst = os.path.join(target_dir, fname)
        if os.path.isfile(src) and not os.path.exists(dst):
            shutil.copy2(src, dst)
            copied.append(fname)
    return copied


# ── HTML generation ───────────────────────────────────────────
def generate_html(template_path: str, target_dir: str, symbol: str, json_filename: str):
    """Generate a view HTML file from the template."""
    with open(template_path) as f:
        html = f.read()

    html = html.replace("{{SYMBOL}}", symbol)
    html = html.replace("{{JSON_FILE}}", json_filename)

    out_name = f"{symbol}.view.html"
    out_path = os.path.join(target_dir, out_name)
    with open(out_path, "w") as f:
        f.write(html)

    return out_path


# ── Main ──────────────────────────────────────────────────────
if __name__ == "__main__":
    args = parse_args(sys.argv[1:])

    if args.get("help") or args.get("h"):
        print(json.dumps(usage(), indent=2))
        sys.exit(0)

    json_path = args.get("file", "")
    if not json_path:
        print(json.dumps(usage(), indent=2))
        sys.exit(0)

    json_path = os.path.expanduser(json_path)
    json_path = os.path.abspath(json_path)

    # Validate
    valid, error, result = validate_stock_json(json_path)
    if not valid:
        print(json.dumps({"status": "error", "error": error}, indent=2))
        sys.exit(0)

    data = result["data"]
    symbol = result["symbol"]
    target_dir = os.path.dirname(json_path)
    json_filename = os.path.basename(json_path)

    # Determine assets source (bundled with the command)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(os.path.dirname(script_dir), "assets")

    if not os.path.isdir(assets_dir):
        print(json.dumps({
            "status": "error",
            "error": f"Assets directory not found: {assets_dir}"
        }, indent=2))
        sys.exit(0)

    # Copy assets to target folder (skip existing)
    copied = copy_assets(assets_dir, target_dir)

    # Generate view HTML
    template_path = os.path.join(assets_dir, "template.html")
    html_path = generate_html(template_path, target_dir, symbol, json_filename)

    print(json.dumps({
        "status": "ok",
        "symbol": symbol,
        "html_file": html_path,
        "json_file": json_path,
        "assets_copied": copied,
        "open_with": f"Open {os.path.basename(html_path)} in your browser to view the chart."
    }, indent=2))
    sys.exit(0)
