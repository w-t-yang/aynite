# DataViewChart — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | `themes`, `activeThemeId` | Apply theme for chart colors |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

Recharts-based chart view (bar, line, area, pie, radar). Loads a JSON file with `{ title, keys[], data[] }` structure. Uses `window.aynite.readFile`, `window.aynite.selectFile`, and `window.aynite.getConfig` directly (bypass bridge) for file/view-config operations.
