# RSSApp — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **Bridge: systemMutations** | `systemMutations.openExternal(url)` | Open article URLs in system browser (also via Space key in keyboard nav) |
| **Bridge: config** (getWithPayload) | `config.getWithPayload('view-config', { view: 'rss' })` | Load view config (key bindings) from `~/.aynite/views/rss/config.json` |

## Events (via `useViewEvent`)

| Event | Payload | Handler |
|-------|---------|---------|
| `theme-changed` | _none_ | Triggers re-render (empty handler) |

## Internal hooks

| Hook | Purpose |
|------|---------|
| `useRSS` | All RSS state management: fetching, group/source CRUD, article read/bookmark tracking, panel widths |

## Description

Full RSS reader with sidebar, article list, article detail, group/source management, and bookmarking. All bridge calls are encapsulated in `useRSS` hook — fetches feeds, manages config persistence, and handles the auth flow.
