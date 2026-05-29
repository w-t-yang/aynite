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
| **Getters and setters are separate exports** | In each bridge module, getters are exported as `domain` and setters as `domainMutations`. This makes the distinction visible at the import site: `import { config, configMutations } from '../bridge'` | Naming convention + audit |
| **Events only through `events.onAppEvent` / `events.onAppOperation`** | No raw IPC listeners. Already enforced by existing audit. | Existing audit |
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

## Migration Plan

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
