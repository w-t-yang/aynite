# DataViewFlow — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | `themes`, `activeThemeId` | Apply theme for node/edge colors |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

ReactFlow-based node editor/visualizer. Loads a JSON file with `{ nodes[], edges[] }` structure. Uses `window.aynite.readFile`, `window.aynite.selectFile`, and `window.aynite.getConfig` directly (bypass bridge) for file/view-config operations.
