# Communication Architecture

## Overview

Aynite has a three-layer architecture: **Main Process**, **Main Renderer**, and **Iframe Views**. Communication between these layers follows strict patterns due to Electron's security model (context isolation, subframe IPC limitations).

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS  (Node.js / Electron)                             │
│  src/main/                                                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  config/      │  │  ai/         │  │  broadcast.ts         │  │
│  │  file/        │  │  workspace/  │  │  broadcastAppEvent()  │  │
│  │  theme/       │  │  spells/     │  └──────────┬───────────┘  │
│  │  system/      │  │  updater/    │             │              │
│  └──────┬───────┘  └──────┬───────┘             │              │
│         │                 │                     │              │
│         ▼                 ▼                     ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  IPC Handlers  (ipcMain.handle / ipcMain.on)             │  │
│  │  ──────────────────────────────────────────────────────  │  │
│  │  Request/Response:  aynite:config-get, aynite:file-read  │  │
│  │  Push Events:       aynite:app-event (single channel)    │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────┐
          │                   │                       │
          ▼                   ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  MAIN RENDERER      │  │  IFRAME VIEW 1      │  │  IFRAME VIEW 2      │
│  (React App Shell)  │  │  (e.g. AI Chat)     │  │  (e.g. Settings)    │
│                     │  │                     │  │                     │
│  request/response:  │  │  request/response:  │  │  request/response:  │
│  invoke() directly  │  │  invoke() directly  │  │  invoke() directly  │
│         ✓           │  │         ✓           │  │         ✓           │
│                     │  │                     │  │                     │
│  push notifications:│  │  push notifications:│  │  push notifications:│
│  onAppEvent()       │  │  postMessage ◄──────┼──┤  postMessage ◄──────┼──┐
│         ✓           │  │         ✓           │  │         ✓           │  │
│                     │  │                     │  │                     │  │
│  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │
│  │ ThemeContext  │  │  │  │ useViewTheme  │  │  │  │ useAppEvent   │  │  │
│  │  └→loadThemes│  │  │  │  └→loadTheme  │  │  │  │  └→handler    │  │  │
│  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │  │
│                     │  │                     │  │                     │  │
│  ┌───────────────┐  │  │                     │  │                     │  │
│  │AppEventRelay  │──┼──┼─────────────────────┼──┼─────────────────────┘  │
│  │  └→postMessage│  │  │                     │  │                        │
│  └───────────────┘  │  │                     │  │                        │
└─────────────────────┘  └─────────────────────┘  └────────────────────────┘
```

## Communication Patterns

### 1. Request/Response — Iframes → Main Process (direct IPC)

Any frame (main renderer or iframe) can make request/response calls via `window.aynite`:

```
Iframe                     Main Process
  │                           │
  ├── invoke(config-get) ────▶│
  │                           ├── routeGetConfig()
  │                           │
  │◄────── response ──────────┤
```

This works because Electron routes the response back to the specific frame that made the `invoke()` call, using the frame's routing ID.

**Iframe call:**
```ts
const themes = await window.aynite.getConfig('themes')
const data = await window.aynite.readFile('/path/to/file')
await window.aynite.setConfig('activeTheme', 'nord')
```

**Main handler** (in any subsystem's `ipc.ts`):
```ts
ipcMain.handle(ConfigChannels.GET, async (_event, { key, payload }) => {
  return await routeGetConfig(key, payload)
})
```

### 2. Push Notifications — Main Process → All Views (broadcast relay)

Push events (e.g., "theme changed", "config updated", "file changed") **cannot** be delivered directly to iframe preloads. `webContents.send()` only reaches the main frame.

The solution is a two-step relay:

```
Main Process                 Main Renderer                       Iframe
     │                           │                                 │
     │ broadcastAppEvent()       │                                 │
     ├── IPC (aynite:app-event)─▶│                                 │
     │                           │                                 │
     │                           ├── AppEventRelay                 │
     │                           │   └── postMessage() ────────────▶│
     │                           │                                 ├── useAppEvent()
     │                           │                                 │   └── handler()
     │                           │                                 │
     │                           ├── Context (e.g. ThemeContext)    │
     │                           │   └── loadThemes()              │
     │                           │   └── applyThemeColors()        │
```

#### Broadcasting from Main Process

Use the `broadcastAppEvent()` utility — the single entry point for all push notifications:

```ts
// src/main/broadcast.ts
import { broadcastAppEvent } from '../broadcast'

// Theme changed
broadcastAppEvent('theme-changed', { themeId: 'nord' })

// Config updated
broadcastAppEvent('config-updated', { key: 'keybindings' })

// File changed
broadcastAppEvent('file-changed', { path: '/some/file.ts' })
```

This sends on the single IPC channel `aynite:app-event` to the main renderer.

#### Receiving in Main Renderer

Components in the main renderer listen directly via `onAppEvent`:

```ts
// In a React context/provider
useEffect(() => {
  const w = window as any
  if (!w.aynite?.onAppEvent) return
  const unsub = w.aynite.onAppEvent((event) => {
    if (event.type === 'theme-changed') loadThemes()
  })
  return () => unsub()
}, [loadThemes])
```

The `AppEventRelay` component (mounted in `ThemeProvider`) receives the same IPC and forwards it to all iframes via `postMessage`:

```ts
// shared/lib/appEvents.ts — AppEventRelay
useEffect(() => {
  const w = window as any
  if (!w.aynite?.onAppEvent) return
  const unsub = w.aynite.onAppEvent((event) => {
    for (const iframe of document.querySelectorAll('iframe')) {
      iframe.contentWindow?.postMessage(
        { type: `aynite:${event.type}`, data: event.data },
        '*',
      )
    }
  })
  return () => unsub()
}, [])
```

#### Receiving in Iframe Views

Views subscribe using the `useAppEvent` hook, which listens for the `postMessage` relay:

```ts
import { useAppEvent } from '../../shared/lib/appEvents'

function MyView() {
  useAppEvent('theme-changed', async (data) => {
    const { themeId } = data as { themeId: string }
    const theme = await window.aynite.getConfig('theme', themeId)
    applyThemeColors(theme)
  })
}
```

## Channel Interface

### IPC Channels (Main Process ↔ Renderer)

All channel constants live in `src/lib/constants/ipc-channels.ts`. The naming convention is:

```
aynite:<domain>-<action>
```

| Domain | Pattern | Examples |
|--------|---------|---------|
| Config | `aynite:config-*` | `aynite:config-get`, `aynite:config-set` |
| File | `aynite:file-*` | `aynite:file-read`, `aynite:file-write` |
| Workspace | `aynite:workspace-*` | `aynite:workspace-list`, `aynite:workspace-switch` |
| AI | `aynite:ai-*` | `aynite:ai-chat`, `aynite:ai-session-save` |
| Theme | `aynite:theme-*` | `aynite:theme-list`, `aynite:theme-save` |
| System | `aynite:system-*` | `aynite:system-font-list`, `aynite:dialog-select-folder` |
| Spells | `aynite:spell-*` | `aynite:spell-skill-list`, `aynite:spell-command-run` |
| Update | `aynite:update-*` | `aynite:update-check`, `aynite:update-downloaded` |

### App Event Channel (Main Process → Main Renderer → Iframes)

The unified push channel:

```
aynite:app-event
Payload: { type: string, data: unknown }
```

Event types use kebab-case: `theme-changed`, `config-updated`, `file-changed`.

### postMessage Events (Main Renderer → Iframes)

The main renderer's `AppEventRelay` prefixes event types with `aynite:` when forwarding via `postMessage`:

```
postMessage({ type: 'aynite:theme-changed', data: { themeId: 'nord' } }, '*')
```

Views subscribe via `useAppEvent('theme-changed', handler)` which matches the unprefixed type.

## Preload Bridge API

The preload (`src/preload/index.ts`) exposes `window.aynite` via `contextBridge`. The public API surface is:

```
window.aynite
  ├── getConfig(key, payload?)      Request/Response
  ├── setConfig(key, payload)       Request/Response
  ├── readFile(path)                Request/Response
  ├── writeFile(path, content)      Request/Response
  ├── ...
  │
  ├── onAppEvent(callback)          Push Notification (main renderer only)
  │   └── callback({ type, data })  └── iframes receive via postMessage relay
  │
  ├── onAppOperation(callback)      Keyboard shortcut dispatch
  └── onThemeChanged(callback)      Legacy — use onAppEvent instead
```

## Design Rules

1. **All request/response** between any frame and the main process uses `window.aynite.*` (direct `ipcRenderer.invoke` → `ipcMain.handle`).

2. **All push notifications** from the main process must use `broadcastAppEvent()` in `src/main/broadcast.ts`. Direct calls to `webContents.send()` for application events are forbidden.

3. **The main renderer** is the single point of relay for push events. It must mount `AppEventRelay` (from `shared/lib/appEvents.ts`) to forward events to iframes.

4. **Iframe views** must use `useAppEvent()` from `shared/lib/appEvents.ts` to subscribe to push events. Direct `window.addEventListener('message', ...)` should be avoided.

5. **Event types** are kebab-case strings, namespaced by domain (e.g., `theme-changed`, `file-changed`, `workspace-switched`).

6. **New push event types** do not require new IPC channels. Add the type string to the event and handle it on the receiving side.

## Extending for Third-Party Views and Plugins

The event bus is designed for extensibility. Third-party views and plugins can:

1. **Register new event types**: Broadcast with `broadcastAppEvent('plugin-<name>-<event>', data)` — no new IPC channel needed.

2. **Subscribe in views**: Use `useAppEvent('plugin-<name>-<event>', handler)` — same hook for all views.

3. **Request data**: Use existing `window.aynite.getConfig()` or propose new config keys.

4. **Contribute preload extensions**: New methods on `window.aynite` follow the same pattern — `contextBridge.exposeInMainWorld` with typed interfaces.

The constant interfaces and channel definitions in `src/lib/constants/` are the contract. Plugin developers only need to know:
- `window.aynite` API for request/response
- `useAppEvent(type, handler)` for subscribing to push events
- Event type naming convention
