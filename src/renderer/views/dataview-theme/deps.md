# DataViewTheme — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | `themes`, `activeThemeId` | Get current theme for reference |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

Theme editor/studio. Loads a JSON file with `{ id, name, colors, type }` structure. Applies live preview of edited colors to `:root` CSS variables. Uses `window.aynite.readFile`, `window.aynite.selectFile`, and `window.aynite.getConfig` directly (bypass bridge) for file/view-config operations.
