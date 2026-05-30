# AiBrowserView — Dependencies

## Context Providers

| Provider | Functions Used | Purpose |
|----------|---------------|---------|
| **ViewContext** (via `useView`) | _(none)_ | Theme context, not used directly |
| **Bridge: config** | `config.get('activeSessionId')`, `config.get('activeFile')` | Determine initial view mode on mount |

## Events (via `useViewEvent`)

| Event | Payload | Handler |
|-------|---------|---------|
| `active-session-changed` | `{ id: string }` | Switches view to AI Chat mode |
| `active-file-changed` | `{ path: string }` | Switches view to File Browser mode |

## Description

Simple router view that toggles between AI Chat and File Browser based on which context is active. No mutations — reads config once on mount, then reacts to events.
