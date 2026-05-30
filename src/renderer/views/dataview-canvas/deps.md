# DataViewCanvas — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | `themes`, `activeThemeId` | Apply theme colors to Excalidraw canvas |
| **Bridge: config** | `config.get('view-config', { view: 'dataview-canvas' })` | Load view configuration (validated schema) |

## Events (via `useViewEvent`)

| Event | Payload | Handler |
|-------|---------|---------|
| `theme-changed` | _none_ | Updates Excalidraw viewBackgroundColor |

## Description

Excalidraw-based canvas view. Loads a JSON file with elements/appState. Uses `window.aynite.readFile` and `window.aynite.selectFile` directly (bypass bridge) for file operations. Listens for theme changes to keep canvas background in sync.
