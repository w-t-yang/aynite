# RFC-003: Typed Bridge Architecture

**Status:** Draft  
**Date:** 2026-05-16  
**Author:** Aynite Team

---

## Objective

This RFC proposes a typed bridge layer that eliminates direct `window.aynite` access from all
renderer code (contexts, shared components, and view micro-apps). The goal is to improve type
safety, reduce bugs from scattered IPC knowledge, and enforce a clean dependency hierarchy.

The existing Hub-and-Spoke communication model (RFC-001) remains intact. This RFC adds a
_static layer_ — the typed bridge — on top of the existing _runtime layer_ (preload IPC).

A central focus of this RFC is the **getter/setter split**: setters must be treated as
state-mutating operations that trigger an event loop, while getters are simple data fetches.
Making this distinction explicit eliminates the class of bugs where a component calls set,
assumes the UI is updated, but the event hasn't propagated yet.

---

## Motivation

### Current Problems

`window.aynite` is referenced **~200+ times** across the renderer:

| Location | Count | Issues |
|----------|-------|--------|
| Context providers (`src/renderer/src/contexts/*`) | ~30 | Direct IPC in state management |
| Shared components (`src/renderer/shared/featured/*`) | 3 | `FileSwitcher`, `UpdateNotification` |
| View Context (`src/renderer/views/ViewContext.tsx`) | ~5 | Spoke base infrastructure |
| Views (`src/renderer/views/*`) | ~170+ | Spread across services, hooks, components |

Each call site:
- Accesses an **untyped** global (`window.aynite`) — TypeScript provides no compile-time safety
- Must **know the exact API shape** — method names, parameters, return types
- Often **guards with `if (!window.aynite) return`** — inconsistent patterns
- Bypasses the Hub for **imperative data operations** — fine per RFC-001, but still fragile

### The Eventual Consistency Bug

The most insidious class of bugs comes from the **set → event → update** loop:

```
View calls setConfig('activeFile', path)
  └─→ IPC invoke to main process
       └─→ Main saves state
            └─→ Main sends sendToWindow(winId, ACTIVE_FILE_CHANGED)
                 └─→ Hub receives onAppEvent
                      └─→ Hub updates its React state
                           └─→ Relay postMessage to iframes
                                └─→ View's useAppEvent fires
                                     └─→ View re-renders
```

**Common bugs from this pattern:**

| Bug | Root Cause |
|-----|------------|
| View calls `setConfig('activeFile', path)`, then immediately calls `getConfig('activeFile')` expecting the new value | IPC invoke is async; the event loop hasn't completed yet |
| Two views both call `setConfig('activeFile', path)` for different files. UI flickers, ends up on wrong file | Race condition — both invokes fire, both events come back, last one wins but the UI shows stale intermediate state |
| View calls `setConfig('theme', {...})` but the theme preview doesn't update until user clicks elsewhere | The main process handler for `setConfig('theme', ...)` doesn't emit `THEME_CHANGED` event — it uses a different path |
| Context provider calls `setConfig('activeWorkspace', id)` then `loadData()` — but `loadData()` reads stale config | `loadData` reads from `getConfig` which returns the old value because the IPC invoke for set hasn't resolved and the broadcast event hasn't arrived |

The root cause is that **setters and getters look the same** at the call site. A developer
calling `bridge.config.set('activeFile', path)` has no way to know:
- Does this trigger an event loop?
- Will the state I just mutated be reflected if I read it right after?
- Who else depends on this state change?

The fix is: **make the setter contract explicit at the type level**.

---

## Proposed Architecture

### Getter / Setter Split

The bridge splits every IPC operation into two explicit categories:

| Category | Behaviour | Return type |
|----------|-----------|-------------|
| **Getter** (`get*`, `read*`, `list*`, `fetch*`) | Pure data fetch. No side effects in the renderer. Single IPC invoke, returns the value. | `Promise<T>` |
| **Setter** (`set*`, `create*`, `delete*`, `rename*`, `save*`, `switch*`, `write*`, `execute*`) | State mutation in the main process. The main process **must** emit an `app-event` after mutation. The renderer must **not** assume the state is updated until the event arrives through `onAppEvent`. | `Promise<void>` |

**The critical rule:** Setters return `Promise<void>`, not the value. This forces callers to
get updated state through the event loop, not by reading the return value of the setter.

### Overview

> **Note on event routing:** In this architecture, there is exactly ONE `bridge.events.onAppEvent` listener (in AppContext) that routes events to the correct context providers. No context provider sets up its own listener. For iframe views, there is exactly ONE `postMessage` listener per iframe (in ViewContext) that routes events to the correct handler. Views NEVER listen to events directly — they consume state from context providers via `useApp()` or from ViewContext via `useViewContext()`. See the [Unified Event Routing Architecture](#unified-event-routing-architecture) section for detailed flow diagrams.

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                        RENDERER LAYERS                                  │
 │                                                                         │
 │  ┌──────────────────────────────────────────────────────────────────┐   │
 │  │  Components & Views                                              │   │
 │  │                                                                  │   │
 │  │  // Getters: simple data fetch, returns value                   │   │
 │  │  const file = await bridge.file.read(path)                       │   │
 │  │                                                                  │   │
 │  │  // Setters: fire-and-forget, no return value                    │   │
 │  │  await bridge.config.set('activeFile', path)                     │   │
 │  │  // DO NOT read config right after — wait for app event         │   │
 │  └──────────────────────────┬───────────────────────────────────────┘   │
 │                              │                                         │
 │  ┌──────────────────────────▼───────────────────────────────────────┐   │
 │  │  Context Providers (Hub)                                        │   │
 │  │                                                                  │   │
 │  │  // Only consumers of onAppEvent                                 │   │
 │  │  // They update React state when events arrive                   │   │
 │  │  bridge.events.onAppEvent((event) => {                           │   │
 │  │    if (event.type === 'active-file-changed') {                   │   │
 │  │      setActiveFile(event.data.path)                              │   │
 │  │    }                                                             │   │
 │  │  })                                                              │   │
 │  └──────────────────────────┬───────────────────────────────────────┘   │
 │                              │                                         │
 │  ┌──────────────────────────▼───────────────────────────────────────┐   │
 │  │  Bridge Layer (src/renderer/bridge/)                             │   │
 │  │                                                                  │   │
 │  │  // ONLY files that reference window.aynite                     │   │
 │  │  // Every function is either a getter (→ T) or setter (→ void)  │   │
 │  └──────────────────────────────────────────────────────────────────┘   │
 └──────────────────────────────────────────────────────────────────────────┘
                                │
                                │ ONLY layer accessing the preload
                                ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Preload (src/preload/index.ts)                                          │
 │                                                                          │
 │  contextBridge.exposeInMainWorld('aynite', { ... })                      │
 └──────────────────────────────────────────────────────────────────────────┘
```

### The Bridge Layer

The bridge lives at `src/renderer/bridge/`. It is the **only** code that accesses
`window.aynite` directly. Each domain gets its own file:

```
src/renderer/bridge/
├── index.ts            # Re-exports everything
├── config.ts           # get* / set* (typed keys)
├── file.ts             # read* / write*, create*, delete*, rename*, copy*
├── workspace.ts        # get* / switch*, create*, delete*, add*, reorder*
├── ai.ts               # aiChat, getPrompt / saveSession, loadSession
├── git.ts              # getStatus / stageHunk, commit*
├── theme.ts            # getThemes, getTheme / deleteTheme
├── update.ts           # checkForUpdates / downloadUpdate, installUpdate
├── system.ts           # openExternal, getSystemFonts, platform, etc.
├── rss.ts              # rssGet* / rssSave*, rssFetch*, rssMark*, rssDelete*
├── spotify.ts          # spotifyGet* / spotifyInitAuth, spotifyPlay*, etc.
├── spells.ts           # getAvailable* / pick*, restore*
├── events.ts           # onAppEvent, onAppOperation, executeAppOperation
└── utils.ts            # joinPath, dirname, writeClipboard
```

Each bridge module:
- Wraps all `window.aynite.*` calls with **full TypeScript types** (input params, return types)
- Handles the **`window.aynite` guard** internally (returns `null`/`undefined` or throws)
- Exports **pure async functions** — no React hooks, no state
- **Setters return `Promise<void>`** — never the mutated value
- Uses the **existing IPC channels** from `src/lib/constants/ipc-channels.ts`

#### Example: `bridge/file.ts` — getters return data, setters return void

```typescript
// src/renderer/bridge/file.ts
import type { FileEntry } from '../src/env.d'

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ── Getters (return data) ────────────────────────────────────────────────
export const file = {
  read: (path: string): Promise<string> => getAynite().readFile(path),

  readBinary: (path: string): Promise<Uint8Array> =>
    getAynite().readFileBinary(path),

  list: (path: string): Promise<FileEntry[]> => getAynite().listFolder(path),

  info: (path: string) => getAynite().getFileInfo(path),

  checkIsText: (path: string): Promise<boolean> =>
    getAynite().checkIsTextFile(path),
}

// ── Setters (return void — state changes come through events) ───────────
export const fileMutations = {
  write: (path: string, content: string): Promise<void> =>
    getAynite().writeFile(path, content).then(() => {}),

  watch: (path: string | null): Promise<void> =>
    getAynite().watchFile(path),

  create: (path: string, isDirectory: boolean): Promise<void> =>
    getAynite().createFile(path, isDirectory).then(() => {}),

  rename: (oldPath: string, newPath: string): Promise<void> =>
    getAynite().renameFile(oldPath, newPath).then(() => {}),

  copy: (srcPath: string, destPath: string): Promise<void> =>
    getAynite().copyFile(srcPath, destPath).then(() => {}),

  delete: (path: string): Promise<void> =>
    getAynite().deleteFile(path).then(() => {}),
}
```

#### Example: `bridge/config.ts` — typed getters and setters

```typescript
// src/renderer/bridge/config.ts
import { ConfigKey } from '../../lib/constants/config'

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available')
  }
  return window.aynite
}

// ── Typed Config Keys ────────────────────────────────────────────────────
// This maps the runtime string keys to TypeScript types, giving callers
// full type safety for config reads and writes.
export interface ConfigSchema {
  [ConfigKey.ACTIVE_FILE]: string | null
  [ConfigKey.ACTIVE_THEME]: string
  [ConfigKey.ACTIVE_WORKSPACE]: string
  [ConfigKey.ACTIVE_SESSION_ID]: string
  [ConfigKey.AI]: { activeId: string }
  [ConfigKey.AGENTS]: { activeId: string }
  [ConfigKey.THEMES]: any[]
  [ConfigKey.WORKSPACES]: any[]
  [ConfigKey.VERSION]: string
  // ... etc
}

// ── Getters (return data) ────────────────────────────────────────────────
export const config = {
  get: <K extends keyof ConfigSchema>(key: K): Promise<ConfigSchema[K]> =>
    getAynite().getConfig(key),

  getWithPayload: <T = any>(key: string, payload?: any): Promise<T> =>
    getAynite().getConfig(key, payload),
}

// ── Setters (return void — state changes come through events) ───────────
export const configMutations = {
  set: async <K extends keyof ConfigSchema>(
    key: K,
    value: ConfigSchema[K],
  ): Promise<void> => {
    await getAynite().setConfig(key, value)
  },
}
```

#### Example: `bridge/events.ts`

```typescript
// src/renderer/bridge/events.ts
type AppEventHandler = (event: { type: string; data: unknown }) => void
type AppOperationHandler = (operation: string, data?: unknown) => void

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available')
  }
  return window.aynite
}

export const events = {
  onAppEvent: (cb: AppEventHandler): (() => void) =>
    getAynite().onAppEvent(cb),

  onAppOperation: (cb: AppOperationHandler): (() => void) =>
    getAynite().onAppOperation(cb),

  execute: (operation: string, data?: unknown): void =>
    getAynite().executeAppOperation(operation, data),
}
```

---

## The Setter Contract

Every setter in the bridge follows this contract:

### For the Setter Caller (Renderer/View)

```
await bridge.configMutations.set('activeFile', path)
// ⚠️ State is NOT yet updated in React. The event hasn't travelled back.
// ✅ The UI will update when the app event arrives through onAppEvent.
// ❌ Do NOT call bridge.config.get('activeFile') here expecting the new value.
```

### For the Event Consumer (Hub)

```
// In WorkspaceContext / UIContext / AppContext:
bridge.events.onAppEvent((event) => {
  if (event.type === 'active-file-changed') {
    // ✅ This is the ONLY place we update React state for activeFile
    setActiveFile(event.data)
  }
})
```

### For the Main Process

Every IPC handler that processes a setter **must** emit an app event after the mutation:

```typescript
// src/main/config/handler.ts
ipcMain.handle(ConfigChannels.SET, async (event, { key, payload }) => {
  // 1. Save the config
  await saveConfig(key, payload, workspaceName)

  // 2. Broadcast the change
  sendToWindow(winId, AppEvents.CONFIG_CHANGED, { key, payload })
  // OR for specific keys:
  if (key === 'activeFile') {
    sendToWindow(winId, AppEvents.ACTIVE_FILE_CHANGED, { path: payload })
  }
})
```

### Enforcement

| Rule | How enforced |
|------|-------------|
| Setters return `Promise<void>` | TypeScript — the bridge function signature enforces this |
| Every setter in preload has a corresponding event | Manual audit — map preload methods to AppEvents |
| Views/components must not read after set | Code review + lint rule (detect `await bridge.X.set(...)` followed by `bridge.X.get(...)`) |
| Hub must listen for events after set | This is the Hub's job — verified by existing Hub-and-Spoke audit |

---

## Strict Dependency Rules

After the bridge is introduced, the following rules apply across all renderer code:

| Rule | Description | Enforced by |
|------|-------------|-------------|
| **No `window.aynite` outside bridge** | The string `window.aynite` must not appear in any file outside `src/renderer/bridge/` | Audit script |
| **No bridge imports in `shared/`** | `shared/` components must not import from bridge. They consume data through `useApp()` hooks from the Hub. | Audit script |
| **Bridge imports allowed in contexts, views, and `ViewContext`** | These layers import typed bridge functions directly for imperative operations. | Convention |
| **Getters and setters are separate exports** | In each bridge module, getters are exported as `domain` and setters as `domainMutations`. Makes distinction visible at import site. | Naming convention + audit |
| **Single `onAppEvent` listener (AppContext only)** | No context provider or component sets up its own `bridge.events.onAppEvent` listener. All event routing happens through AppContext's single listener. | Audit script + code review |
| **Single `postMessage` listener per iframe (ViewContext only)** | No view sets up its own `window.addEventListener('message')`. All message routing happens through ViewContext's single listener. | Audit script + code review |
| **Views never listen to events directly** | Views consume state from context providers (via `useApp()`) or from ViewContext (via `useViewContext()`). No `useAppEvent()` calls in individual view files. | Audit script |
| **Events only through `bridge.events.onAppEvent`** | No raw `window.aynite.onAppEvent` calls outside bridge. | Existing audit |
| **`postMessage` relay only in Hub (AppContext) and Spoke (ViewContext)** | Already enforced by existing audit. | Existing audit |

### Rationale for `shared/` being bridge-free

Components in `renderer/shared/` are meant to be reusable UI primitives. They should not know
about Electron or IPC. When a shared component needs data from the bridge, the Hub context
should expose it as a prop or callback:

| Shared Component | Current (window.aynite) | Fixed |
|---|---|---|
| `FileSwitcher` | `window.aynite.workspaceAllFiles()` | `useApp().getAllFiles()` (getter from Hub) |
| `FileSwitcher` | `window.aynite.setConfig('activeFile', path)` | `useApp().setActiveFile(path)` (setter through Hub) |
| `UpdateNotification` | `window.aynite.installUpdate()` | `useApp().installUpdate()` (setter through Hub) |

---

## Audit Rules & Fix Examples

An automated audit script (`scripts/audit-bridge-architecture.ts`) enforces all architectural rules.
Run it with `npm run audit:bridge-architecture` to check for violations.

Each violation includes a fix example. Below are the canonical before/after patterns for every rule.

### RULE-1: No `window.aynite` outside bridge/

**Violation:** 170 occurrences across the renderer.

```
❌ BAD (src/renderer/views/treeview/Treeview.tsx):
  window.aynite.setConfig('activeFile', path)

✅ GOOD:
  import { configMutations } from '../../bridge'
  configMutations.set('activeFile', path)
```

```
❌ BAD (src/renderer/views/settings/Settings.tsx):
  const version = await window.aynite.getConfig('version')

✅ GOOD:
  import { config } from '../../bridge'
  const version = await config.get('version')
```

### RULE-2: No `bridge` imports in `shared/`

**Violation:** 0 occurrences (already clean).

```
❌ BAD (src/renderer/shared/featured/FileSwitcher.tsx):
  import { workspace } from '../bridge'

✅ GOOD:
  import { useApp } from '../../src/AppContext'
  const { getAllFiles } = useApp()
  // getAllFiles is exposed by WorkspaceContext through useApp()
```

### RULE-3: No `useAppEvent()` in individual views

**Violation:** 17 occurrences. Views must not listen to events directly.

```
❌ BAD (src/renderer/views/workspace-view/WorkspaceView.tsx):
  useAppEvent('active-session-changed', (data) => {
    setActiveSessionId(data.id)
  })

✅ GOOD:
  // Step 1: Add handler to ViewContext.tsx (the single message router):
  // In ViewContext.tsx:
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data?.type?.startsWith('aynite:')) return
      const type = event.data.type.replace('aynite:', '')
      const data = event.data.data
      switch (type) {
        case 'active-session-changed':
          setActiveSessionId(data.id)
          bridge.ai.listSessions().then(setSessions)
          break
        // ... all other events
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Step 2: Consume state in WorkspaceView.tsx:
  const { sessions, activeSessionId } = useViewContext()
  // No useAppEvent() call needed — state comes from context
```

```
❌ BAD (src/renderer/views/treeview/hooks/useGitStatus.ts):
  useAppEvent('git-status-changed', handleGitStatusChanged)

✅ GOOD:
  // Add 'git-status-changed' handler to ViewContext.tsx:
  case 'git-status-changed':
    bridge.git.getGitStatus(data.root).then((status) => {
      setGitStatus((prev) => ({ ...prev, [data.root]: status }))
    })
  // Consume in useGitStatus:
  const { gitStatus } = useViewContext()
```

### RULE-4: Single `onAppEvent` listener (AppContext only)

**Violation:** 6 occurrences. No context provider may set up its own event listener.

```
❌ BAD (src/renderer/src/contexts/ThemeContext.tsx):
  useEffect(() => {
    const unbind = bridge.events.onAppEvent((event) => {
      if (event.type === 'theme-changed') refreshThemes()
    })
    return unbind
  }, [refreshThemes])

✅ GOOD:
  // In AppContext.tsx — single event router:
  useEffect(() => {
    const unbind = bridge.events.onAppEvent((event) => {
      switch (event.type) {
        case AppEvents.THEME_CHANGED:
          themeActionsRef.current?.refreshThemes()
          break
        case AppEvents.WORKSPACE_CHANGED:
          workspaceActionsRef.current?.loadData()
          break
        case AppEvents.ACTIVE_FILE_CHANGED:
          uiActionsRef.current?.setActiveFile(event.data.path)
          break
        // ... all other events
      }
      // Then relay to iframes
      relayToIframes(event)
    })
    return unbind
  }, [])

  // ThemeContext exposes its actions via a ref that AppContext can call:
  // ThemeContext provides: themeActionsRef.current = { refreshThemes }
  // AppContext calls: themeActionsRef.current?.refreshThemes()
```

```
❌ BAD (src/renderer/src/contexts/UIContext.tsx):
  const unbind = window.aynite.onAppEvent((event) => {
    if (event.type === 'active-file-changed') {
      setActiveFile(event.data.path)
    }
  })

✅ GOOD:
  // UIContext exposes a setActiveFile action via ref:
  useEffect(() => {
    uiActionsRef.current = { setActiveFile }
  }, [setActiveFile])
  // AppContext calls uiActionsRef.current?.setActiveFile(data.path)
```

### RULE-5: Single `postMessage` listener per iframe (ViewContext only)

**Violation:** 1 occurrence.

```
❌ BAD (src/renderer/views/settings/AboutTab.tsx):
  window.addEventListener('message', handler)

✅ GOOD:
  // All message listening goes through ViewContext.tsx.
  // If AboutTab needs message data, ViewContext stores it in state
  // and AboutTab consumes it via useViewContext().
```

### RULE-6: No raw `window.aynite.onAppEvent`

**Violation:** 8 occurrences. Must go through `bridge.events.onAppEvent`.

```
❌ BAD (src/renderer/src/contexts/WorkspaceContext.tsx):
  window.aynite.onAppEvent((event) => { ... })

✅ GOOD:
  import { events } from '../bridge'
  events.onAppEvent((event) => { ... })
  // But better: move to AppContext single router (see RULE-4)
```

### Running the Audit

```bash
# Check for all violations
npx tsx scripts/audit-bridge-architecture.ts

# Exit with code 1 on any violation (for CI)
npx tsx scripts/audit-bridge-architecture.ts --check
```

Add to `package.json`:
```json
{
  "scripts": {
    "audit:bridge-architecture": "tsx scripts/audit-bridge-architecture.ts"
  }
}
```

---

## Migration Plan

### Phase 0: Create audit script and establish baseline

Create `scripts/audit-bridge-architecture.ts` that enforces all 6 architectural rules.
Run it to establish the current baseline: ~202 violations (170 RULE-1, 17 RULE-3, 6 RULE-4, 1 RULE-5, 8 RULE-6).

**Audit script lives at:** `scripts/audit-bridge-architecture.ts`

### Phase 1: Create the bridge layer

Create `src/renderer/bridge/` with all domain modules. Each module exports both getters
(`domain`) and setters (`domainMutations`) as separate namespaces. No callers yet.

**Files to create:** ~12 bridge modules

### Phase 2: Move `ayniteConfig` class into bridge

The existing `src/lib/constants/renderer/config.ts` is already a partial typed wrapper.
Move it to `bridge/config.ts`, split into `config` (getters) and `configMutations` (setters),
and update its callers.

**Callers to update:**
- `src/renderer/src/contexts/WorkspaceContext.tsx` (uses `ayniteConfig`)
- `src/renderer/src/contexts/ThemeContext.tsx` (uses `ayniteConfig`)

### Phase 3: Update Hub context providers

Replace `window.aynite.*` calls in all 6 context providers with bridge imports.
Context providers are the **only** consumers of `events.onAppEvent` — they listen for
state changes that were triggered by setters and update React state accordingly.

**Files to update:**
- `src/renderer/src/AppContext.tsx` (uses `window.aynite`)
- `src/renderer/src/contexts/WorkspaceContext.tsx` (uses `window.aynite`)
- `src/renderer/src/contexts/ThemeContext.tsx` (uses `window.aynite`)
- `src/renderer/src/contexts/UIContext.tsx` (uses `window.aynite`)
- `src/renderer/src/contexts/UpdateContext.tsx` (uses `window.aynite`)
- `src/renderer/src/contexts/WindowContext.tsx` (uses `window.aynite`)
- `src/renderer/src/contexts/LayoutContext.tsx` (uses `window.aynite`)

### Phase 4: Update ViewContext (Spoke base)

Replace `window.aynite.*` calls in `ViewContext.tsx` with bridge imports.

### Phase 5: Update shared components

Expose callbacks from `useApp()` for `FileSwitcher` and `UpdateNotification`.

**Changes:**
- `AppContext.tsx` — add `getAllFiles` and `setActiveFile` and `installUpdate` to the `useApp()` return
- `FileSwitcher.tsx` — use `useApp().getAllFiles()` and `useApp().setActiveFile(path)`
- `UpdateNotification.tsx` — use `useApp().installUpdate()`

### Phase 6: Update views

Replace `window.aynite.*` calls in all view code with bridge imports. This is the largest
change but mechanically the simplest — it's a find-and-replace per domain.

**Key principle during view migration:** Every setter call that was `window.aynite.setX(...)`
and then immediately read the result (`window.aynite.getX(...)`) must be refactored to
use the event-driven pattern:
1. Call the bridge setter (returns void)
2. React to state changes from `useAppEvent` or from the Hub's relayed state

**Views to update:**
- `aichat/` (hooks, services, utils, components) — `bridge.ai`, `bridge.config`, `bridge.workspace`
- `file-browser/` (hooks) — `bridge.file`, `bridge.config`
- `fileview-*` — `bridge.file`
- `settings/` — `bridge.config`, `bridge.theme`, `bridge.system`, `bridge.spells`, `bridge.update`
- `treeview/` — `bridge.workspace`, `bridge.file`, `bridge.config`
- `rss/` — `bridge.rss`
- `spotify/` — `bridge.spotify`
- `workspace-view/` — `bridge.workspace`, `bridge.ai`, `bridge.config`, `bridge.file`

### Phase 7: Add audit rules

Two new audit scripts / additions:

**`scripts/audit-bridge.ts`** — Scans for `window.aynite` references outside `src/renderer/bridge/`.

**`scripts/audit-set-event-loop.ts`** — Maps every setter in the bridge to its corresponding
app event in `AppEvents`, and verifies that:
1. Every setter has a corresponding event emission in the main process handler
2. Every event has a corresponding listener in the Hub

---

## Migration Impact Analysis

### Total changes

| Phase | Files to create | Files to modify | Risk |
|-------|-----------------|-----------------|------|
| 1 (Bridge) | ~12 | 0 | Low — new code, no callers |
| 2 (ayniteConfig) | 0 | ~3 | Low — mechanical rename |
| 3 (Contexts) | 0 | 7 | Medium — state initialization paths |
| 4 (ViewContext) | 0 | 1 | Low — mechanical replacement |
| 5 (Shared) | 0 | 3 | Low — adding hooks to Hub |
| 6 (Views) | 0 | ~20+ | **High** — requires careful review of set → read patterns |
| 7 (Audit) | 2 | 1 | Low — infra only |

### Backward compatibility

- The bridge does not change the preload API — `window.aynite` still exists at runtime
- Views that are not updated (e.g., third-party views) still work by calling `window.aynite` directly
- The bridge is an _import-time_ abstraction, not a runtime one

---

## Unified Event Routing Architecture

Before diving into specific flows, here is the single event routing pattern that applies to ALL events in the system. This is the core architectural invariant of the bridge.

```
┌────────────────────────────────────────────────────────────────────┐
│  VIEW LAYER (Renderer component or iframe view)                     │
│                                                                     │
│  Any component calls a setter:                                      │
│    await bridge.configMutations.set('activeFile', path)              │
│    await bridge.gitMutations.commitExecute(root, msg)               │
│    await bridge.aiMutations.saveSession(id, [])                     │
│                                                                     │
│  └─→ Promise<void> — NO return value, caller does NOT re-fetch     │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ IPC invoke
┌───────────────────────▼─────────────────────────────────────────────┐
│  MAIN PROCESS                                                        │
│                                                                      │
│  1. Perform the mutation (save file, run git commit, write config)   │
│  2. Emit ONE event:                                                  │
│     sendToWindow(winId, EVENT_TYPE, data)  [to caller's window]     │
│     OR broadcastAppEvent(EVENT_TYPE, data) [to ALL windows]         │
│                                                                      │
│  Events are the ONLY way state changes are communicated back         │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ preload → contextBridge
┌───────────────────────▼─────────────────────────────────────────────┐
│  MAIN RENDERER — SINGLE EVENT ROUTER                                 │
│                                                                      │
│  AppContext has exactly ONE bridge.events.onAppEvent listener:       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Step 1: Route event to the correct context provider         │    │
│  │                                                              │    │
│  │  THEME_CHANGED       ──→ ThemeContext updates state          │    │
│  │  WORKSPACE_CHANGED   ──→ WorkspaceContext updates state      │    │
│  │  WORKSPACE_UPDATED   ──→ WorkspaceContext updates state      │    │
│  │  ACTIVE_FILE_CHANGED ──→ UIContext updates activeFile        │    │
│  │  CONFIG_CHANGED      ──→ Relevant context reloads config     │    │
│  │  TILE_ACTIVATED      ──→ LayoutContext updates tileId        │    │
│  │  UPDATE_*            ──→ UpdateContext updates update state   │    │
│  │  WINDOW_*            ──→ WindowContext updates window state   │    │
│  │  CONFIG_ERROR        ──→ Logged, no state update             │    │
│  │  GIT_STATUS_CHANGED  ──→ No main-renderer handler (no git    │    │
│  │                          UI in main renderer)                │    │
│  │                                                              │    │
│  │  Step 2: Relay to ALL iframe views via postMessage           │    │
│  │  └─→ postMessage({ type: 'aynite:{eventType}', data })      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  No context provider sets up its own onAppEvent listener.            │
│  All event routing goes through AppContext's single listener.        │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ React context flows down
           ┌────────────┴────────────┐
           │                         │
┌──────────▼──────────┐ ┌───────────▼───────────┐
│  Main Renderer       │ │  Iframe Views          │
│  Components          │ │                        │
│                      │ │  ViewContext has       │
│  useApp() exposes:   │ │  exactly ONE message   │
│  ├─ workspaceConfig  │ │  listener:             │
│  ├─ activeTheme      │ │                        │
│  ├─ activeFile       │ │  Route event type to   │
│  ├─ updateStatus     │ │  the correct handler:  │
│  ├─ isMaximized      │ │                        │
│  └─ ...              │ │  theme-changed       │ │
│                      │ │    └─ loadTheme()      │ │
│  Components read     │ │  git-status-changed  │ │
│  from useApp():      │ │    └─ refreshGit()     │ │
│  ├─ TitleBar         │ │  active-session-ch.  │ │
│  ├─ Tile             │ │    └─ loadSession()    │ │
│  ├─ UpdateBanner     │ │  active-file-changed │ │
│  ├─ FileSwitcher     │ │    └─ setActiveFile()  │ │
│  └─ UpdateNotific.   │ │  fs-change           │ │
│                      │ │    └─ reloadTree()     │ │
│  Shared components   │ │  ...                  │ │
│  useApp() — never    │ │                        │ │
│  window.aynite       │ │  No view sets up its   │ │
│                      │ │  own event listener.   │ │
│                      │ │  All views consume     │ │
│                      │ │  state from            │ │
│                      │ │  ViewContext.          │ │
└──────────────────────┘ └────────────────────────┘
```

### The Key Rules

| Rule | Why |
|------|-----|
| **ONE `bridge.events.onAppEvent` listener (in AppContext)** | No context provider sets up its own listener. Event routing is centralized, not scattered. |
| **ONE `postMessage` listener per iframe (in ViewContext)** | No view calls `useAppEvent()` or `addEventListener('message')`. All event reception goes through ViewContext. |
| **Views NEVER listen to events directly** | They consume state from context providers (via `useApp()`) or from ViewContext (via `useView()`). |
| **Setters return `Promise<void>`** | No caller can read a return value, eliminating the "read after set" bug pattern entirely. |

### Flow 1: Git Commit → File Browser Diff Clears + GitDiffView Empties

When a user commits changes from the GitDiffView, three components must update simultaneously without any component knowing about the others:
1. **GitDiffView** — the committed files disappear from the changed-files list
2. **File Browser** — any file tab showing a diff view should revert to its normal mode
3. **TreeView** — git status badges next to changed files should clear

#### Sequence

```
User clicks "Commit" in GitDiffView
  │
  ├─❶ GitDiffView calls bridge.gitMutations.commitExecute(root, message)
  │    └─→ Promise<void> — GitDiffView does NOT re-fetch
  │
  ▼❷ Main process (src/main/git/index.ts — COMMIT_EXECUTE handler)
  ├─ Executes `git add -A && git commit -m '...'`
  ├─ Calls statusManager.refreshStatus(root, true) — clears all pending changes
  └─ broadcastAppEvent(AppEvents.GIT_STATUS_CHANGED, { root })
  │
  ▼❸ AppContext — single onAppEvent listener fires
  ├─ Routes event: GIT_STATUS_CHANGED has no main-renderer handler
  │  (no git UI in main renderer context providers)
  └─ Relays to ALL iframes via postMessage:
       postMessage({ type: 'aynite:git-status-changed', data: { root } })
  │
  ▼❹ Each iframe's ViewContext — single message listener receives it
  ├─ Routes to git-status-changed handler
  │  └─ Calls bridge.git.getGitStatus(root) → returns empty (all committed)
  │  └─ Updates ViewContext's gitStatus state (reactive, not event-driven)
  │
  ▼❺ All views re-render because their source of truth (ViewContext state) changed
  ├─ GitDiffView: reads useViewContext().gitStatus → empty → "No changes"
  ├─ useFileModes: reads useViewContext().gitStatus → no diff → reverts to view/edit
  ├─ useGitStatus: reads useViewContext().gitStatus → no badges → tree looks clean
  └─ WorkspaceView's GitDiffView: same — "No changes" for every folder
```

#### What Changed From Current Architecture

| Aspect | Current (broken) | New (centralized) |
|--------|-----------------|-------------------|
| **Number of event listeners** | 6+ (one per context, one per view, one per hook) | 2 (one in AppContext, one in ViewContext per iframe) |
| **Where views get git status** | Each view calls `useAppEvent('git-status-changed', handler)` | View reads `useViewContext().gitStatus` — ViewContext handles the event centrally |
| **GitDiffView after commit** | Manually calls `loadGitStatus(folders)` after commit | Does nothing — ViewContext re-fetches when event arrives |
| **useFileModes after commit** | Separate `useAppEvent` with `setDiffRefreshKey` hack | Reads `useViewContext().gitStatus` — automatically re-evaluates |
| **useGitStatus after commit** | Separate `useAppEvent` with its own re-fetch | Reads `useViewContext().gitStatus` — automatically re-evaluates |
| **Race condition risk** | High — one view might re-fetch before another, showing stale intermediate state | Zero — all views read the same state from the same re-fetch |

### Flow 2: New Session Created → Session List Updates in WorkspaceView + AIChat

When a new AI chat session is created (either from AIChat's "New Chat" or WorkspaceView's "+" button), all session-aware views must update:
1. **WorkspaceView** — session list highlights the new session
2. **AIChat** — loads the new empty session when navigated to
3. **AiBrowser** — session list highlights the new session

#### Sequence

```
User clicks "New Chat" in AIChat (or "+" in WorkspaceView)
  │
  ├─❶ AIChat calls ChatService.createNewSession():
  │    ├─ bridge.aiMutations.saveSession(newId, [])
  │    │    └─ Main process writes empty session file to disk
  │    │    └─ Promise<void>
  │    └─ bridge.configMutations.set('activeSessionId', newId)
  │         └─ Main process saves workspace state
  │         └─ sendToWindow(winId, ACTIVE_SESSION_CHANGED, { id: newId })
  │         └─ Promise<void>
  │
  ▼❷ Main process emits ACTIVE_SESSION_CHANGED
  └─ sendToWindow(callerWinId, AppEvents.ACTIVE_SESSION_CHANGED, { id: newId })
  │
  ▼❸ AppContext — single onAppEvent listener fires
  ├─ Routes event: ACTIVE_SESSION_CHANGED has no main-renderer handler
  │  (sessions are view-level data, not managed by any main-renderer context)
  └─ Relays to ALL iframes via postMessage:
       postMessage({ type: 'aynite:active-session-changed', data: { id: newId } })
  │
  ▼❹ Each iframe's ViewContext — single message listener receives it
  ├─ Routes to active-session-changed handler
  │  ├─ Updates activeSessionId state to newId
  │  └─ Re-fetches session list: bridge.ai.listSessions() → includes new session
  │     (If the session is new and not in ChatService memory,
  │      ChatService.loadSessionById is also called to prepare the empty session)
  │
  ▼❺ Views re-render:
  ├─ WorkspaceView: sessions list re-renders with new session highlighted
  └─ AIChat: useEffect fires because activeSessionId changed → loads empty session
```

#### Write-Then-Set Contract

The `createNewSession()` function follows a critical ordering:

```typescript
// ChatService.createNewSession()
async function createNewSession(): Promise<string> {
  const newId = Date.now().toString()

  // STEP 1: Write the file FIRST
  await bridge.aiMutations.saveSession(newId, [])
  // ✓ File exists on disk now

  // STEP 2: THEN set the config (which emits the event)
  await bridge.configMutations.set('activeSessionId', newId)
  // ✓ Event fires → listeners try to load session → file exists

  return newId
}
```

This ordering guarantees that when the `ACTIVE_SESSION_CHANGED` event arrives at listeners, the session file already exists on disk. If the setter were called before the file was written, listeners would fail to load the new session.

#### What Changed From Current Architecture

| Aspect | Current (broken) | New (centralized) |
|--------|-----------------|-------------------|
| **Event listening** | WorkspaceView: `useAppEvent('active-session-changed', ...)`, AIChat: `useAppEventSubscriber(...)`, ChatService: `init(subscribeFn)` — 3 different patterns | ViewContext: single listener routes to both |
| **Session list refresh** | WorkspaceView manually calls `loadData()` after session changes | ViewContext re-fetches `bridge.ai.listSessions()` centrally |
| **Active session highlight** | WorkspaceView manages its own `activeSessionId` state | ViewContext manages `activeSessionId` — all views read from it |
| **New session loading** | AIChat: `useEffect` with `ChatService.loadSessionById` + separate guard | ViewContext handles loading, AIChat just reads `useViewContext().activeSessionId` |

---

## Open Questions

1. **Should the bridge throw or return `null` when `window.aynite` is undefined?**
   - Throwing makes bugs visible early (runtime crash)
   - Returning `null` makes it safe for testing outside Electron
   - **Proposal:** Throw by default, provide a `isAvailable` flag for guard checks

2. **Should `src/lib/constants/renderer/` be cleaned up?**
   - After moving `config.ts` to bridge, the `renderer/` directory under constants will have one file left (`styles.ts`)
   - **Proposal:** Keep `styles.ts` where it is — it's just CSS class strings, not IPC

3. **Should we add a React hook wrapper `useBridge()`?**
   - Some teams prefer `const { file, config } = useBridge()` instead of `import { bridge } from '../bridge'`
   - **Proposal:** Not needed — direct import is simpler, tree-shakeable, and avoids React dependency in non-component code (services, utils)

4. **Should the `env.d.ts` types be generated from bridge?**
   - Currently `AyniteWindow` is manually maintained in `env.d.ts`, which drifts from preload
   - **Proposal:** Not immediately — let bridge be the typed consumer interface first, generate types from preload as a future improvement

5. **Should all setters really be `Promise<void>`?**
   - Some setters like `createWorkspace` currently return `Promise<WorkspacesConfig>`. Making them `void` means any caller that needs the result must subscribe to the event and wait for it.
   - **Proposal:** Yes — enforce `void` for all setters. If a caller needs the result, the event carries it back. This eliminates the race condition entirely.

---

## Decisions (2026-05-21 — Architecture Grilling Session)

The following decisions were reached during the architecture review:

| Question | Decision | Rationale |
|----------|----------|-----------|
| **12 bridge files or codegen?** | 12 files | More maintainable than codegen. Allows semantic enrichment (getter/setter split, typed config keys, domain comments). Each file lives with its domain and is obvious to find. |
| **`shared/` can import bridge?** | No | `shared/` must not import bridge. Shared components (including `shared/featured/`) consume data through `useApp()` hooks from the Hub. This enforces a clean flow: bridge → context → shared component. |
| **Merge context providers?** | No | Keep 6 separate providers, each with one clear responsibility. Ref-based cross-communication (`registerSetActiveTileId`, `registerRefreshThemes`) is minor and will be eliminated when contexts switch to bridge imports (no need for ref-passing when both contexts import from the same bridge module). |
| **Setters return `Promise<void>`?** | Yes | Unifies behavior — the event loop is the single source of truth for state updates. Prevents callers from mixing "read after set" patterns with event-based updates. The main process already emits events for all setters; contexts must trust the loop. |
| **Bridge throw or return null?** | Throw | `if (!window.aynite) return` guards are defensive code from browser-testing era. Throw makes bugs visible instantly. Provide `isAvailable` export for conditional code. |
| **Centralized event routing?** | Yes | ONE `bridge.events.onAppEvent` listener in AppContext routes to all context providers. ONE `postMessage` listener per iframe in ViewContext routes to all view handlers. No context provider or view sets up its own listener. Views consume state from context, not from events. |
