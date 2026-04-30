#!/usr/bin/env python3
"""
Fetch stock data from Yahoo Finance and save as JSON.
Uses the yfinance library (pip install yfinance).

Always exits with code 0 so Aynite can display the JSON output.
Use the "status" field to determine success: "ok" or "error".
"""

import sys
import json
import os
import logging
from datetime import datetime, timezone

# Suppress yfinance's internal HTTP error logging
logging.getLogger("yfinance").setLevel(logging.CRITICAL)
logging.getLogger("urllib3").setLevel(logging.CRITICAL)

# ── Dependency check ──────────────────────────────────────────
try:
    import yfinance as yf
except ImportError:
    print(json.dumps({
        "status": "error",
        "error": "Python package 'yfinance' is not installed.",
        "fix": "Run: pip install yfinance"
    }, indent=2))
    sys.exit(0)


# ── Argument parsing ──────────────────────────────────────────
def parse_args(argv):
    """Parse --key value and --key=value style arguments."""
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
        "error": "Missing required parameter: --symbol",
        "usage": {
            "description": "Fetch stock market data from Yahoo Finance and save as JSON.",
            "syntax": "> stock-fetch --symbol <TICKER> [options]",
            "required": [
                {"name": "--symbol", "description": "Stock ticker symbol (e.g., AAPL, GOOGL, TSLA)"}
            ],
            "optional": [
                {"name": "--output", "description": "Folder to save the JSON file", "default": "~/aynite-data"},
                {"name": "--period", "description": "Data period (default: 1y): 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max", "default": "1y"},
                {"name": "--interval", "description": "Data interval: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo", "default": "1d"}
            ],
            "examples": [
                "> stock-fetch --symbol AAPL",
                "> stock-fetch --symbol GOOGL --period 5d --output ~/stonks",
                "> stock-fetch --symbol TSLA --period 1mo --interval 1h"
            ]
        }
    }


# ── Core fetch logic ──────────────────────────────────────────
def fetch_stock(symbol: str, period: str, interval: str, output_dir: str):
    try:
        ticker = yf.Ticker(symbol)

        info = ticker.info
        if not info or (
            info.get("shortName") is None
            and info.get("longName") is None
            and info.get("symbol") is None
        ):
            print(json.dumps({
                "status": "error",
                "error": f"No data found for symbol '{symbol.upper()}'. Check the ticker and try again.",
            }, indent=2))
            return

        history = ticker.history(period=period, interval=interval)
        actions = ticker.actions

        payload = {
            "metadata": {
                "symbol": symbol.upper(),
                "period": period,
                "interval": interval,
                "fetched_at": datetime.now(timezone.utc).isoformat()
            },
            "info": {
                "name": info.get("shortName") or info.get("longName", "N/A"),
                "sector": info.get("sector", "N/A"),
                "industry": info.get("industry", "N/A"),
                "market_cap": info.get("marketCap"),
                "currency": info.get("currency", "USD"),
                "exchange": info.get("exchange", "N/A"),
                "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
                "previous_close": info.get("previousClose") or info.get("regularMarketPreviousClose"),
                "fifty_day_avg": info.get("fiftyDayAverage"),
                "two_hundred_day_avg": info.get("twoHundredDayAverage"),
            },
            "history": _parse_history(history),
            "actions": _parse_actions(actions),
        }

        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.abspath(os.path.join(output_dir, f"{symbol.upper()}.json"))
        with open(filepath, "w") as f:
            json.dump(payload, f, indent=2, default=str)

        print(json.dumps({
            "status": "ok",
            "symbol": symbol.upper(),
            "file": filepath,
            "records": len(payload["history"])
        }, indent=2))

    except Exception as e:
        msg = str(e)
        if "No data found" in msg or "possibly delisted" in msg or "Not Found" in msg:
            print(json.dumps({
                "status": "error",
                "error": f"Symbol '{symbol.upper()}' not found. It may be delisted, invalid, or have no data for the requested period."
            }, indent=2))
        else:
            print(json.dumps({
                "status": "error",
                "error": f"Failed to fetch data for '{symbol.upper()}': {msg.split(chr(10))[0]}"
            }, indent=2))


def _parse_history(df):
    if df is None or df.empty:
        return []
    records = []
    for idx, row in df.iterrows():
        rec = {"date": str(idx)}
        for col in df.columns:
            rec[col.lower()] = row[col]
        records.append(rec)
    return records


def _parse_actions(df):
    if df is None or df.empty:
        return {"dividends": [], "splits": []}
    records = []
    for idx, row in df.iterrows():
        rec = {"date": str(idx)}
        for col in df.columns:
            rec[col.lower()] = row[col]
        records.append(rec)
    dividends = [r for r in records if r.get("dividends", 0) != 0]
    splits = [r for r in records if r.get("stock splits", 0) != 0]
    return {"dividends": dividends, "splits": splits}


# ── Main ──────────────────────────────────────────────────────
if __name__ == "__main__":
    args = parse_args(sys.argv[1:])

    if args.get("help") or args.get("h"):
        print(json.dumps(usage(), indent=2))
        sys.exit(0)

    symbol = args.get("symbol", "")
    if not symbol:
        print(json.dumps(usage(), indent=2))
        sys.exit(0)

    period = args.get("period", "1y")
    interval = args.get("interval", "1d")
    output_dir = os.path.expanduser(args.get("output", os.path.join(os.path.expanduser("~"), "aynite-data")))

    fetch_stock(symbol, period, interval, output_dir)
    sys.exit(0)
