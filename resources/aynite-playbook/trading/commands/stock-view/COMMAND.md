---
name: stock-view
description: Generate an interactive HTML chart view from a stock-data JSON file.
parameters:
  - name: file
    description: Path to a stock-data JSON file (produced by stock-fetch)
    required: true
---

# stock-view

Takes a stock-data JSON file and generates an interactive HTML chart view in the same folder.

## Requirements

The JSON file must be in the format produced by `stock-fetch` (with `info`, `history`, and `metadata` fields). An internet connection is required on first view (Chart.js loaded from CDN).

## Usage

```
> stock-view --file ~/aynite-data/AAPL.json
> stock-view --file ./data/GOOGL.json
```

## Output

- Copies shared assets (`viewer.js`, `style.css`) to the JSON file's folder (once — shared across all views)
- Generates `<SYMBOL>.view.html` in the same folder
- Open the HTML file in any browser to see an interactive chart with price history and volume

## Chart Features

- Candlestick-style price chart (high/low range + close line)
- Volume bar chart below
- Hover tooltips with OHLCV details
- Company info sidebar (name, sector, market cap, etc.)
- Dark theme matching Aynite's aesthetic
