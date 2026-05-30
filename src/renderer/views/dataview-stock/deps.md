# DataViewStock — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | `themes`, `activeThemeId` | Apply theme for chart colors |
| **ViewContext** (via `useAppOperation`) | `executeOperation('fetch-chart-data', ...)` | Request new chart data from main process |

## Events (via `useViewEvent`)

| Event | Payload | Handler |
|-------|---------|---------|
| `chart-data` | `{ data, symbol, timeframe?, indicators?, compareData?, compareSymbol? }` | Processes incoming chart data with indicators, updates all chart state |

## Description

Candlestick stock chart viewer with technical indicators (SMA, EMA, Bollinger, MACD, RSI, etc.). Uses `window.aynite.readFile`, `window.aynite.selectFile`, and `window.aynite.getConfig` directly (bypass bridge) for file operations. Supports real-time data updates via the `chart-data` event.
