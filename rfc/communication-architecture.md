# RFC-001: Communication Architecture

**Status:** Draft  
**Date:** 2026-05-09  
**Author:** Aynite Team

---

## Objective

This document describes the communication architecture of the Aynite application. Aynite is an
Electron app with a unique three-layer architecture where the renderer process is a pure
tiling/layout manager and each tile loads a view in an isolated iframe. The ambition is to allow
any self-built view to be loaded dynamically into any tile.

This design introduces a challenge: how to coordinate state across the main process, the
renderer (layout manager), and multiple iframe-based views simultaneously. This RFC documents
the centralized communication patterns that solve this problem.

---

## Architecture Overview

### Three-Layer Model

The application is split into three distinct layers, each with a specific responsibility:

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                          MAIN PROCESS                                    │
 │                     (src/main/index.ts)                                   │
 │                                                                           │
 │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐ │
 │  │  Config  │  │   File   │  │ Workspace │  │    AI    │  │   Theme   │ │
 │  │          │  │          │  │           │  │          │  │           │ │
 │  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └─────┬─────┘ │
 │       │             │              │             │              │       │
 │  ┌────▼─────────────▼──────────────▼─────────────▼──────────────▼─────┐ │
 │  │                    window.ts (Broadcast Center)                     │ │
 │  │                                                                     │ │
 │  │  sendToWindow(winId, type, data)   (targeted to one window)         │ │
 │  │  broadcastAppEvent(type, data)     (sent to ALL windows)            │ │
 │  │  sendOperationToWindow(winId, op)  (targeted operation)             │ │
 │  │  sendAppEvent(type, data)          (legacy, first window only)      │ │
 │  │  sendAppOperation(op, data)        (legacy, first window only)      │ │
 │  └─────────────────────┬─────────────────────────────┬─────────────────┘ │
 └────────────────────────┼─────────────────────────────┼───────────────────┘
                          │                             │
                    aynite:app-event              aynite:app-operation
                    (webContents.send)            (webContents.send)
                          │                             │
 ┌────────────────────────┼─────────────────────────────┼───────────────────┐
 │                        ▼                             ▼                   │
 │              ┌─────────────────────────────────────────────┐             │
 │              │         PRELOAD BRIDGE (IPC Layer)           │             │
 │              │   src/preload/index.ts                       │             │
 │              │   contextBridge → window.aynite              │             │
 │              │                                              │             │
 │              │  onAppEvent(cb)   onAppOperation(cb)        │             │
 │              │  executeAppOperation(op)  getConfig() ...   │             │
 │              └──────────────────┬──────────────────────────┘             │
 │                                 │                                        │
 │                                 │                                        │
 │  ┌──────────────────────────────┴──────────────────────────────────────┐ │
 │  │                    RENDERER (Hub)                                    │ │
 │  │               src/renderer/src/AppContext.tsx                        │ │
 │  │                                                                      │ │
 │  │  onAppEvent ──→  ┌──────────────────────┐  onAppOperation ──→       │ │
 │  │                  │   AppContext (Hub)    │    executeAppOperation()   │ │
 │  │                  │                      │                            │ │
 │  │                  │  ┌────────────────┐  │                            │ │
 │  │                  │  │  State Update  │  │                            │ │
 │  │                  │  └───────┬────────┘  │                            │ │
 │  │                  │          │            │                            │ │
 │  │                  │  ┌───────▼────────┐  │                            │ │
 │  │                  │  │  Relay to all  │  │                            │ │
 │  │                  │  │  iframes       │  │                            │ │
 │  │                  │  │  postMessage() │  │                            │ │
 │  │                  │  └───────┬────────┘  │                            │ │
 │  │                  └──────────┼───────────┘                            │ │
 │  │                             │                                        │ │
 │  │              ┌──────────────┼──────────────┐                        │ │
 │  │              │              │              │                         │ │
 │  │              ▼              ▼              ▼                         │ │
 │  │  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐           │ │
 │  │  │   Tile 1       │ │   Tile 2       │ │   Tile N       │           │ │
 │  │  │   ┌──────────┐ │ │   ┌──────────┐ │ │   ┌──────────┐ │           │ │
 │  │  │   │ <iframe> │ │ │   │ <iframe> │ │ │   │ <iframe> │ │           │ │
 │  │  │   │ View     │ │ │   │ View     │ │ │   │ View     │ │           │ │
 │  │  │   │ Context  │ │ │   │ Context  │ │ │   │ Context  │ │           │ │
 │  │  │   │ (Spoke)  │ │ │   │ (Spoke)  │ │ │   │ (Spoke)  │ │           │ │
 │  │  │   └──────────┘ │ │   └──────────┘ │ │   └──────────┘ │           │ │
 │  │  └────────────────┘ └────────────────┘ └────────────────┘           │ │
 │  │                    VIEWS (Spokes)                                    │ │
 │  └──────────────────────────────────────────────────────────────────────┘ │
 └──────────────────────────────────────────────────────────────────────────┘
```

#### Layer Responsibilities

| Layer | Directory | Role |
|-------|-----------|------|
| **Main Process** | `src/main/` | Node.js backend. Source of truth for all data (config, files, workspace, AI, themes). Must only push data to the renderer through `sendAppEvent()` or `sendAppOperation()`. |
| **Renderer (Hub)** | `src/renderer/src/` | Tile layout management, global state, event relay. The **only** code that registers listeners for main process events. Receives events from main, updates state, and relays to iframe views. |
| **Views (Spokes)** | `src/renderer/views/` | Isolated micro-apps loaded in iframes. Each receives system events via the Hub's relay. Never speaks to the main process via IPC directly — uses `window.aynite` (exposed through preload) for data operations. |

---

## Communication Primitives

There are exactly **three** communication primitives in the system:

### 1. App Event — Window-Scoped or Broadcast (`aynite:app-event`)

A push notification from the main process that flows through the renderer and is relayed to
iframe views. Events can be **window-scoped** (targeting one specific Electron window) or
**broadcast** (sent to all windows).

**Which to use:**

| Scope | Function | When |
|-------|----------|------|
| **Window-scoped** | `sendToWindow(winId, type, data)` | Events related to a specific window's workspace: `ACTIVE_FILE_CHANGED`, `AI_CHAT_DELTA`, `ACTIVE_SESSION_CHANGED`, `TILE_ACTIVATED`, `WINDOW_*` states |
| **Broadcast** | `broadcastAppEvent(type, data)` | Global events affecting all windows: `THEME_CHANGED`, `CONFIG_CHANGED`, `FS_CHANGE`, `GIT_STATUS_CHANGED`, `UPDATE_*`, `CONFIG_ERROR`, `WORKSPACE_CHANGED` (deletion) |
| **Legacy** | `sendAppEvent(type, data)` | Deprecated — sends to first window only. Keep for backward compat but prefer scoped variants. |

```
 ┌──────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
 │  Main    │      │  Preload     │      │  Hub        │      │  Spokes      │
 │  window  │      │  (IPC)       │      │  AppContext │      │  (iframes)   │
 │  .ts     │      │              │      │             │      │              │
 └────┬─────┘      └──────┬───────┘      └──────┬──────┘      └──────┬───────┘
      │                   │                      │                   │
      │ sendToWindow(win) │  or broadcastAppEvent()                  │
      │ (type, data)      │                      │                   │
      │──────────────────►│                      │                   │
      │                   │ webContents.send     │                   │
      │                   │ aynite:app-event     │                   │
      │                   │─────────────────────►│                   │
      │                   │                      │                   │
      │                   │                      │ update state      │
      │                   │                      │────┐              │
      │                   │                      │    │              │
      │                   │                      │◄───┘              │
      │                   │                      │                   │
      │                   │                      │ postMessage       │
      │                   │                      │ aynite:{type}     │
      │                   │                      │──────────────────►│
      │                   │                      │                   │
      │                   │                      │                   │ useAppEvent
      │                   │                      │                   │ (type, cb)
```

**Resolution:** A `WindowSession` registry (`src/main/window-state.ts`) maps `BrowserWindow.id`
to the window's selected workspace. IPC handlers use `event.sender` → `getWinIdFromSender()`
to identify the calling window.

**Source functions** (defined in `src/main/window.ts`):
- `sendToWindow(winId, type, data)` — Send event to a specific window
- `broadcastAppEvent(type, data)` — Send to ALL registered windows
- `sendAppEvent(type, data)` — Legacy, sends to first window only

**Consumed by:** `src/renderer/src/AppContext.tsx` → `onAppEvent` listener  
**Relayed to:** All iframes via `contentWindow.postMessage({ type: 'aynite:{type}', data }, '*')`  
**Received by:** `src/renderer/views/ViewContext.tsx` → `useAppEvent(type, callback)`  

**Event types** (defined in `src/lib/constants/app.ts` → `AppEvents`):
`theme-changed`, `fs-change`, `file-renamed`, `file-deleted`, `active-file-changed`,
`workspace-changed`, `workspace-updated`, `config-changed`, `active-session-changed`,
`session-deleted`, `session-saved`, `tile-activated`, `ai-chat-delta`, `ai-approval-request`,
`update-*` events, `config-error`.

### 2. App Operation — Renderer Only (`aynite:app-operation`)

A signal from the main process (or from a view via preload) that targets only the renderer's
layout/state system. **Not** broadcast to iframes. Used for keyboard shortcuts, layout
management (tile split, resize, cycle, close), and global UI commands (toggle panels,
settings, notifications, etc.).

```
 ┌──────────┐      ┌──────────────┐      ┌─────────────┐
 │  Main    │      │  Preload     │      │  Hub        │
 │  window  │      │  (IPC)       │      │  AppContext │
 │  .ts     │      │              │      │             │
 └────┬─────┘      └──────┬───────┘      └──────┬──────┘
      │                   │                      │
      │ sendAppOperation  │                      │
      │ (op, data)        │                      │
      │──────────────────►│                      │
      │                   │ webContents.send     │
      │                   │ aynite:app-operation │
      │                   │─────────────────────►│
      │                   │                      │
      │                   │                      │ executeAppOperation(op)
      │                   │                      │────┐
      │                   │                      │    │ layout operations
      │                   │                      │◄───┘ state changes
```

Views can also **trigger** app operations back through the hub:

```
 ┌──────────────┐      ┌─────────────┐      ┌──────────┐
 │  View        │      │  Hub        │      │  Main    │
 │  (iframe)    │      │  AppContext │      │          │
 └──────┬───────┘      └──────┬──────┘      └────┬─────┘
        │                     │                   │
        │ postMessage         │                   │
        │ { type:             │                   │
        │   'aynite:          │                   │
        │    operation',      │                   │
        │   operation, data } │                   │
        │────────────────────►│                   │
        │                     │ executeApp        │
        │                     │ Operation(op)     │
        │                     │───┐               │
        │                     │   │ (or forward   │
        │                     │◄──┘ to main via   │
        │                     │    ipcRenderer    │
        │                     │    .send)         │
```

**OR** from a view using the preload bridge directly:

```
 ┌──────────────┐      ┌──────────────┐      ┌─────────────┐
 │  View        │      │  Preload     │      │  Hub        │
 │  (iframe)    │      │  (IPC)       │      │  AppContext │
 └──────┬───────┘      └──────┬───────┘      └──────┬──────┘
        │                     │                      │
        │ window.aynite       │                      │
        │ .executeAppOp       │                      │
        │ (operation)         │                      │
        │────────────────────►│                      │
        │                     │ ipcRenderer.send     │
        │                     │ aynite:app-operation │
        │                     │─────────────────────►│
        │                     │                      │
```

**Source:** `src/main/window.ts` → `sendAppOperation(op, data)`  
**View trigger:** `src/preload/index.ts` → `window.aynite.executeAppOperation(op, data)` or `src/renderer/views/ViewContext.tsx` → `useAppOperation()`  
**Consumed by:** `src/renderer/src/AppContext.tsx` → `onAppOperation` → `executeAppOperation()`

**Operation types** (defined in `src/lib/constants/app.ts` → `AppOperation`):
`TILE_CYCLE`, `TILE_SPLIT_HORIZONTAL`, `TILE_SPLIT_VERTICAL`,
`TILE_RESIZE_LEFT/RIGHT/UP/DOWN`, `TILE_CLOSE`, `REFRESH_APP`,
`TOGGLE_LEFT_PANEL`, `TOGGLE_RIGHT_PANEL`, `FOCUS_CHAT`, `FOCUS_SKILLS`,
`FOCUS_COMMANDS`, `SHOW_NOTIFICATION`, `SWITCH_FILE`, `SETTINGS`, `QUIT`.

### 3. Direct Invoke — Request/Response

The standard Electron `ipcMain.handle` / `ipcRenderer.invoke` pattern. Used for all
data-fetching and command operations. Any layer (renderer or view) can call methods on
`window.aynite` to get or set data from the main process. This is a **direct** call — it
travels from the caller to the main process and back, bypassing the Hub entirely.

```
 ┌──────────────┐      ┌──────────────┐      ┌──────────┐
 │  Any Layer   │      │  Preload     │      │  Main    │
 │  (renderer   │      │  (IPC)       │      │          │
 │   or iframe) │      │              │      │          │
 └──────┬───────┘      └──────┬───────┘      └────┬─────┘
        │                     │                   │
        │ window.aynite       │                   │
        │ .getConfig(key)     │                   │
        │────────────────────►│                   │
        │                     │ ipcRenderer       │
        │                     │ .invoke(channel)  │
        │                     │──────────────────►│
        │                     │                   │
        │                     │     response      │
        │                     │◄──────────────────│
        │◄────────────────────│                   │
        │                     │                   │
```

**Available methods** (defined in `src/preload/index.ts`):
`getConfig`, `setConfig`, `listFolder`, `readFile`, `writeFile`, `createFile`, `renameFile`,
`copyFile`, `deleteFile`, `getFileInfo`, `getWorkspaceFolders`, `workspaceAllFiles`,
`aiChat`, `getMergedSystemPrompt`, `saveSession`, `loadSession`, `listSessions`,
`getThemes`, `getTheme`, `openFile`, `activateTile`, etc.

---

## Concrete Flow Examples

### Example 1: Treeview opens a file (single window)

A user clicks a file in the treeview. The treeview calls the main process to open the file.
The main process updates the calling **window's** workspace state, then sends a **window-scoped**
event so other views in the same window react:

```
Treeview                     Main Process                  AppContext              FileBrowser
 (iframe)                    (src/main/)                   (Hub)                    (iframe)
    │                            │                            │                       │
    │  window.aynite            │                            │                       │
    │  .setConfig(              │                            │                       │
    │   'activeFile', path)     │                            │                       │
    │──────────────────────────►│                            │                       │
    │                           │  getWinIdFromSender()      │                       │
    │                           │  → win A                   │                       │
    │                           │  getWindowWorkspace(win A) │                       │
    │                           │  → "Project X"             │                       │
    │                           │  saveWorkspaceState("X",   │                       │
    │                           │    { activeFile: path })   │                       │
    │                           │                            │                       │
    │                           │  sendToWindow(             │                       │
    │                           │   win A, ACTIVE_FILE_      │                       │
    │                           │   CHANGED, { path })       │                       │
    │                           │───────────────────────────►│                       │
    │                           │                            │  Update state         │
    │                           │                            │  setActiveFile(path)  │
    │                           │                            │                       │
    │                           │                            │  postMessage          │
    │                           │                            │  (aynite:active-file  │
    │                           │                            │   -changed)           │
    │                           │                            │──────────────────────►│
    │                           │                            │                       │
    │                           │                            │                       │  useAppEvent(
    │                           │                            │                       │  'active-file-
    │                           │                            │                       │  changed', cb)
    │                           │                            │                       │
    │                           │                            │                       │  window.aynite
    │                           │                            │                       │  .readFile(path)
    │                           │◄───────────────────────────────────────────────────│
    │                           │                            │                       │
    │                           │  Return file content       │                       │
    │                           │───────────────────────────────────────────────────►│
    │                           │                            │                       │
    │                           │                            │                       │  Open tab with
    │                           │                            │                       │  content
```

**Key difference:** The main process identifies **which window** made the request via
`getWinIdFromSender(event.sender)`, resolves that window's workspace via `getWindowWorkspace(winId)`,
and sends the result event **only** to that window via `sendToWindow(winId, ...)`. Other
windows with different workspaces remain unaffected.

Global events (theme changes, file system changes, updates) use `broadcastAppEvent()` instead,
which sends to all registered windows.

### Example 2: FileBrowser switches active tab

A user clicks a file tab in the file browser. It notifies the main process, which saves the
active file. The broadcast event updates the treeview's highlight:

```
FileBrowser                  Main Process                  AppContext               Treeview
 (iframe)                    (src/main/)                   (Hub)                    (iframe)
    │                            │                            │                       │
    │  window.aynite            │                            │                       │
    │  .setConfig(              │                            │                       │
    │   'activeFile', path)     │                            │                       │
    │──────────────────────────►│                            │                       │
    │                           │  Save activeFile           │                       │
    │                           │                            │                       │
    │                           │  sendAppEvent              │                       │
    │                           │  (ACTIVE_FILE_CHANGED,     │                       │
    │                           │   { path })                │                       │
    │                           │───────────────────────────►│                       │
    │                           │                            │  Update state         │
    │                           │                            │                       │
    │                           │                            │  postMessage          │
    │                           │                            │  (aynite:active-file  │
    │                           │                            │   -changed)           │
    │                           │                            │──────────────────────►│
    │                           │                            │                       │
    │                           │                            │                       │  useAppEvent(
    │                           │                            │                       │  'active-file-
    │                           │                            │                       │  changed', cb)
    │                           │                            │                       │
    │                           │                            │                       │  Highlight file
    │                           │                            │                       │  in tree
```

### Example 3: Keyboard shortcut for tile split

A keyboard shortcut is pressed. The main process detects it via `before-input-event`,
matches against configured keybindings, then sends an operation to the renderer:

```
Keyboard                      Main Process                  AppContext
 Event                        (src/main/)                   (Hub)
   │                              │                            │
   │  before-input-event          │                            │
   │─────────────────────────────►│                            │
   │                              │  Match against             │
   │                              │  keybindings               │
   │                              │                            │
   │                              │  sendAppOperation          │
   │                              │  ('TILE_SPLIT_HORIZONTAL') │
   │                              │───────────────────────────►│
   │                              │                            │
   │                              │                            │  executeAppOperation
   │                              │                            │  ('TILE_SPLIT_...')
   │                              │                            │
   │                              │                            │  Update layout state
   │                              │                            │  (no iframe broadcast)
```

---

## File Reference Map

| Component | File | Key Export |
|-----------|------|------------|
| Broadcast Center | `src/main/window.ts` | `sendToWindow()`, `sendOperationToWindow()`, `broadcastAppEvent()`, `sendAppEvent()` (legacy), `sendAppOperation()` (legacy) |
| Window State Registry | `src/main/window-state.ts` | `registerWindow()`, `unregisterWindow()`, `getWindowWorkspace()`, `setWindowWorkspace()`, `getWinIdFromSender()`, `onWindowClose()` |
| IPC Channel Constants | `src/lib/constants/ipc-channels.ts` | `AppEventChannel`, `AppOperationChannel` |
| Event/Operation Enums | `src/lib/constants/app.ts` | `AppEvents`, `AppOperation`, `ViewOperation` |
| Preload Bridge | `src/preload/index.ts` | `contextBridge` → `window.aynite` |
| Hub (Event Handler) | `src/renderer/src/AppContext.tsx` | `AppProvider`, `useApp()`, `executeAppOperation()` |
| Spoke Base | `src/renderer/views/ViewContext.tsx` | `ViewProvider`, `useAppEvent()`, `useAppOperation()`, `useAppEventSubscriber()`, `renderView()` |

---

## Communication Rules

The following rules are enforced by automated audit scripts to maintain architectural integrity.

### From `scripts/audit-communication.ts`

| Rule | Description | Exceptions |
|------|-------------|------------|
| **No raw `webContents.send()`** | Push notifications must use `sendAppEvent()` / `sendAppOperation()` from `src/main/window.ts`. Direct `webContents.send()` is forbidden outside the broadcast center. | — |
| **No `ipcRenderer.on()` in renderer** | Renderer code must not use raw `ipcRenderer.on()`. Listeners go through the preload bridge: `window.aynite.onAppEvent()`. | — |
| **No `ipcRenderer` outside preload** | `ipcRenderer` is only accessible in `src/preload/index.ts`. All other code uses `window.aynite`. | `src/lib/`, `src/main/` |
| **No legacy `onThemeChanged()`** | Use `onAppEvent('theme-changed', handler)` instead. | — |
| **No raw IPC channel strings** | IPC channel strings (`'aynite:*'`) must be defined in `src/lib/constants/ipc-channels.ts` and imported by reference, not inlined. | `ipc-channels.ts`, `appEvents.ts`, `preload/index.ts`, `broadcast.ts` |

### From `scripts/base-audit-event.ts` (Hub-and-Spoke Audit)

| Rule | Description |
|------|-------------|
| **No listeners outside Hub** | `onAppEvent` / `onAppOperation` listeners are only allowed in `AppContext.tsx`. No other component may register these listeners. |
| **No `postMessage` outside Hub/Spoke** | Manual `postMessage` calls are only allowed in the Hub (AppContext) and Spoke base (ViewContext). |
| **No manual message listeners in views** | Views must not use `addEventListener('message', ...)` directly. Use `useAppEvent()` from ViewContext instead. |
| **No hardcoded `'aynite:'` strings** | Hardcoded `'aynite:'` event prefix strings are only allowed in Hub/Spoke infrastructure files. |

### Design Constraints

Beyond what the audit enforces, the following conventions must be followed:

1. **Views must not `postMessage` to the renderer** directly, except with the known message type `{ type: 'aynite:operation', operation, data }` which the Hub listens for.

2. **Renderer must not send events directly to iframes** except through the centralized relay in `AppContext`'s `onAppEvent` handler.

3. **Main process must not use `webContents.send()` directly** — always use the `sendAppEvent()` / `sendAppOperation()` helpers.

4. **Data fetching is always direct.** If a view needs data, it calls `window.aynite.readFile()` or similar — no need to route through events. Events are for push notifications, not data requests.

---

## Summary

Events can be **window-scoped** (targeted to one window) or **broadcast** (to all windows):

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      WINDOW-SCOPED EVENTS                               │
  │                                                                         │
  │  sendToWindow(winId, type, data)                                        │
  │  ──→ Only the specified Electron window receives the event              │
  │                                                                         │
  │  Used for: ACTIVE_FILE_CHANGED, AI_CHAT_DELTA,                         │
  │            ACTIVE_SESSION_CHANGED, TILE_ACTIVATED,                      │
  │            WORKSPACE_CHANGED (folder ops)                               │
  └─────────────────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                      BROADCAST EVENTS                                   │
  │                                                                         │
  │  broadcastAppEvent(type, data)                                          │
  │  ──→ ALL registered Electron windows receive the event                  │
  │                                                                         │
  │  Used for: THEME_CHANGED, FS_CHANGE, GIT_STATUS_CHANGED,              │
  │            UPDATE_*, CONFIG_CHANGED, CONFIG_ERROR                      │
  └─────────────────────────────────────────────────────────────────────────┘
```

Full control flow:

```
                    sendToWindow(winId) or           onAppEvent()
                    broadcastAppEvent()
  Main Process ─────────────────────────────────► Preload ───────────► AppContext (Hub)
  (data source,                                 (IPC)       │            │
   window-state.ts)                                          │       postMessage
       ▲                                                    │            │
       │         invoke/handle                              │       aynite:{type}
       │◄───────────────────────────────────────────────────┤            │
       │                                                    │            ▼
       │                                          useAppEvent()    View Spokes
       │                                          (type, cb)◄─────── (iframes)
       │
       │   sendOperationToWindow(winId)   onAppOperation()   executeAppOperation()
       ├─────────────────────────────────► Preload ──────────► AppContext (Hub)
       │                                                          │
       │                                                          │ layout/state only
       │                                                          ▼ (no iframe)
       │                                                  Tile System
       │
       └──── window.aynite.*() ──── invoke/handle ──── Main handles
            (from any layer)
```

### Window Identity Resolution

Every IPC handler can identify the calling window:

```typescript
// src/main/config/router.ts
ipcMain.handle(ConfigChannels.GET, async (event, { key, payload }) => {
  const winId = getWinIdFromSender(event.sender)
  const workspaceName = await getWindowWorkspace(winId)
  // ... resolve key against workspaceName
})
```

The `BrowserWindow.id` is the unique identifier. The registry (`window-state.ts`) maps
these IDs to per-window state (workspace, active file, sessions).

---

## Open Questions

None at this time. The pattern is established, implemented, and audited.
