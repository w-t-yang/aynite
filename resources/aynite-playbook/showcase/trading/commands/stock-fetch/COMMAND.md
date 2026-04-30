---
name: stock-fetch
description: Fetch stock market data as JSON using Yahoo Finance and save it to a file.
parameters:
  - name: symbol
    description: Stock ticker symbol (e.g., AAPL, GOOGL, TSLA)
    required: true
  - name: output
    description: Folder to save the JSON file (defaults to current directory)
    required: false
    default: "~/aynite-data"
  - name: period
    description: Data period — 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max
    required: false
    default: "1y"
  - name: interval
    description: Data interval — 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
    required: false
    default: "1y"
---

# stock-fetch

Fetches stock market data from Yahoo Finance (via the `yfinance` Python library) and saves it as a pretty-printed JSON file.

## Requirements

- Python 3 with `yfinance` installed: `pip install yfinance`

## Usage

```
> stock-fetch --symbol AAPL
> stock-fetch --symbol GOOGL --period 5d --output ~/stonks
> stock-fetch --symbol TSLA --period 1mo --interval 1h --output ./data
```

## Output

Produces a file named `<SYMBOL>.json` (e.g., `AAPL.json`) in the specified output folder. The JSON includes:

- **info** — Company metadata (name, sector, market cap, etc.)
- **history** — OHLCV price data for the requested period/interval
- **actions** — Dividends and stock splits
- **metadata** — Query parameters used (symbol, period, interval, fetched_at timestamp)
