# DataViewGraph — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | _(none)_ | Theme not used (handles its own colors) |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

Force-directed graph visualization with bipartite layout. Uses `window.aynite.readFile`, `window.aynite.selectFile`, and `window.aynite.getConfig` directly (bypass bridge) for file/view-config operations. Runs its own animation loop for force-directed layout.
