# FileViewMarkdown — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: configMutations** | `configMutations.set('activeFile', path)` | Open local link paths in file browser |
| **Bridge: systemMutations** | `systemMutations.openExternal(url)` | Open external URLs in system browser |

## Events

| Event | Payload | Handler |
|-------|---------|---------|
| _none_ | — | No event subscriptions |

## Description

Markdown renderer with syntax highlighting, local file link resolution, and external URL handling. Uses react-markdown with GFM and rehype-raw. Intercepts anchor clicks to distinguish local file links (opened in file browser) from external URLs (opened in system browser).
