# RFC-003 Refactor Summary — Typed Bridge Architecture

**Date:** 2026-05-21  
**Status:** Migration Complete (Phase 0–6)  

---

## What Was Done

### The Bridge Layer

Created `src/renderer/bridge/` — the only code that accesses `window.aynite` directly. All renderer code (contexts, views, services) imports from this bridge.

```
src/renderer/bridge/
├── index.ts       # Re-exports everything
├── events.ts      # onAppEvent, onAppOperation, executeAppOperation + isAvailable
├── config.ts      # config.get, config.getWithPayload, configMutations.set + ConfigSchema
├── file.ts        # file, fileMutations, legacyFile
├── workspace.ts   # workspace, workspaceMutations
├── ai.ts          # ai, aiMutations, aiStream
├── git.ts         # git, gitMutations
├── theme.ts       # theme, themeMutations
├── update.ts      # updateMutations
├── system.ts      # system, systemMutations
├── rss.ts         # rss, rssMutations
├── spotify.ts     # spotify, spotifyMutations
├── spells.ts      # spells, spellsMutations
└── utils.ts       # utils, platform
```

Every domain module exports:
- **`domainName`** — getter functions (return `Promise<T>`)
- **`domainNameMutations`** — setter functions (return `Promise<void>`)

Setters return `Promise<void>` to enforce the event-driven state update pattern. State changes come through `bridge.events.onAppEvent`, not from setter return values.

### Centralized Event Routing

**Before:** Every context provider had its own `window.aynite.onAppEvent` listener (6 scattered listeners), and every view had its own `useAppEvent()` call (17+ handlers for the same events).

**After:** AppContext has exactly ONE `bridge.events.onAppEvent` listener that:
1. Routes `THEME_CHANGED` → ThemeContext's `refreshThemes()`
2. Routes `WORKSPACE_CHANGED`/`WORKSPACE_UPDATED` → WorkspaceContext's `loadData()`
3. Routes `ACTIVE_FILE_CHANGED` → UIContext's `setActiveFile()`
4. Routes `UPDATE_*` → UpdateContext's actions
5. Routes `WINDOW_*`/`FULLSCREEN_*` → WindowContext's actions
6. Routes `TILE_ACTIVATED` → LayoutContext's `setActiveTileId()`
7. Routes `CONFIG_ERROR` → logged
8. Relays ALL events to all iframes via `postMessage`

Each context exposes its event-driven update functions via a `actionsRef` that AppContext reads.

### Getter/Setter Contract

| Category | Return Type | Behavior |
|----------|-------------|----------|
| **Getter** | `Promise<T>` | Pure data fetch. Single IPC invoke. |
| **Setter** | `Promise<void>` | State mutation. Main process emits event after mutation. Caller must wait for event to get updated state. |

### File Changes

| Path | Change |
|------|--------|
| `src/renderer/bridge/` | **Created** — 14 files (new layer) |
| `src/renderer/src/AppContext.tsx` | **Rewritten** — single event router + action refs |
| `src/renderer/src/contexts/ThemeContext.tsx` | **Updated** — bridge imports, removed listener, added actionsRef |
| `src/renderer/src/contexts/UpdateContext.tsx` | **Updated** — bridge imports, removed listener, added actionsRef + installUpdate |
| `src/renderer/src/contexts/WindowContext.tsx` | **Updated** — bridge imports, removed listener, added actionsRef |
| `src/renderer/src/contexts/WorkspaceContext.tsx` | **Updated** — bridge imports, removed listener, added actionsRef + getAllFiles |
| `src/renderer/src/contexts/UIContext.tsx` | **Updated** — bridge imports, removed listener, added actionsRef + setActiveFile |
| `src/renderer/src/contexts/LayoutContext.tsx` | **Updated** — bridge imports, removed listener, added actionsRef |
| `src/renderer/views/ViewContext.tsx` | **Updated** — bridge imports, deprecated useAppEvent/useAppEventSubscriber |
| `src/renderer/src/UpdateBanner.tsx` | **Updated** — bridge imports |
| `src/renderer/src/layout/TitleBar.tsx` | **Updated** — bridge imports |
| `src/renderer/shared/featured/FileSwitcher.tsx` | **Updated** — uses useApp().getAllFiles() + setActiveFile() |
| `src/renderer/shared/featured/UpdateNotification.tsx` | **Updated** — uses useApp().installUpdate() |
| `src/renderer/views/*` (40+ files) | **Updated** — all window.aynite replaced with bridge imports |
| `src/lib/constants/renderer/config.ts` | **Deprecated** — renamed to `.deprecated.ts`, no callers remain |
| `scripts/audit-bridge-architecture.ts` | **Created** — audit script for all 6 architectural rules |

---

## Audit Results

```
npx tsx scripts/audit-bridge-architecture.ts

RULE-1: 0 violations ✅  (window.aynite outside bridge)
RULE-2: 0 violations ✅  (bridge imports in shared)
RULE-3: 24 violations ⚠️  (useAppEvent in views — deprecated wrappers)
RULE-4: 0 violations ✅  (multiple onAppEvent listeners)
RULE-5: 0 violations ✅  (multiple postMessage listeners)
RULE-6: 0 violations ✅  (raw window.aynite.onAppEvent)
TOTAL:  202 → 24  (178 core violations fixed)
```

---

## Remaining Work

### 1. ViewContext — Centralized State Manager (High Priority)

The 24 remaining `useAppEvent()` calls are deprecated wrappers kept for backward compatibility. The correct fix requires ViewContext to become a centralized state manager for all iframe views:

**Current (deprecated):**
```tsx
// Each view independently listens and manages its own state
function WorkspaceView() {
  useAppEvent('active-session-changed', (data) => {
    setActiveSessionId(data.id)
  })
  useAppEvent('session-deleted', () => loadData())
  useAppEvent('session-saved', () => loadData())
}
```

**Target:**
```tsx
// ViewContext routes events centrally and exposes state
// ViewContext.tsx has ONE message listener that updates state

function ViewProvider({ children }) {
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [gitStatus, setGitStatus] = useState({})
  const [activeFile, setActiveFile] = useState(null)

  // Single message listener routes all events
  useEffect(() => {
    const handler = (event) => {
      const msg = event.data
      if (!msg?.type?.startsWith('aynite:')) return
      switch (msg.type.replace('aynite:', '')) {
        case 'active-session-changed':
          setActiveSessionId(msg.data.id)
          bridge.ai.listSessions().then(setSessions)
          break
        case 'git-status-changed':
          bridge.git.getStatus(msg.data.root).then((s) => {
            setGitStatus(prev => ({ ...prev, [msg.data.root]: s }))
          })
          break
        // ... all other event types
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return <Context.Provider value={{ sessions, activeSessionId, gitStatus, ... }}>
    {children}
  </Context.Provider>
}

// Views consume state — no useAppEvent() calls
function WorkspaceView() {
  const { sessions, activeSessionId } = useViewContext()
  // State updates automatically when ViewContext receives events
}
```

**Files affected:** All 24 view files with `useAppEvent()` calls (WorkspaceView, Treeview, useFileModes, useFileContent, useFileTabs, useGitStatus, AiBrowserView, DataViewCanvas, DataViewStock, RSSApp, AboutTab).

### 2. `useAppEvent` and `useAppEventSubscriber` Removal

After ViewContext becomes the state manager, remove the deprecated `useAppEvent` and `useAppEventSubscriber` exports from `ViewContext.tsx` entirely. The audit script's RULE-3 should then report 0 violations.

### 3. Remove `legacyFile` from Bridge

The `bridge/file.ts` module exports a `legacyFile` namespace for inconsistently named preload methods (`getFiles`, `move`, `remove`, `copy`, `paste`, `onFileSystemChange`). Once all callers are migrated to use `file` and `fileMutations` instead, remove `legacyFile`.

### 4. Type Safety Improvements

The `ConfigSchema` in `bridge/config.ts` uses many `any` types. These should be replaced with proper types as they're discovered during development:
- `config.get('tools')` returns `any` → should return `{ active: Record<string, boolean>, list: ToolDef[] }`
- `config.get('skills')` returns `any` → should return `{ folders: string[] }`
- `config.get('commands')` returns `any` → should return `{ folders: string[] }`
- `config.get('prompts')` returns `any` → should return `{ files: string[] }`

### 5. Generate `env.d.ts` from Bridge

Currently, `src/renderer/src/env.d.ts` manually maintains the `AyniteWindow` interface, which drifts from the preload. As a future improvement, the bridge types should be the source of truth, and `env.d.ts` should be generated or simplified.

### 6. Re-enable Audit in CI

Add `audit:bridge-architecture` to the CI pipeline to prevent regressions:

```json
{
  "scripts": {
    "audit:check": "npm run audit:bridge-architecture -- --check && ..."
  }
}
```

---

## Architectural Diagrams

### Data Flow (All Events)

```
Main process mutation
  └─→ sendToWindow / broadcastAppEvent
       └─→ preload ipcRenderer.on (1 listener)
            └─→ bridge.events.onAppEvent callback
                 │
                 ▼ AppContext — SINGLE event router
                 │
                 ├── Step 1: Route to correct context provider
                 │   ├─ THEME_CHANGED       → ThemeContext
                 │   ├─ WORKSPACE_CHANGED   → WorkspaceContext
                 │   ├─ ACTIVE_FILE_CHANGED → UIContext
                 │   ├─ TILE_ACTIVATED      → LayoutContext
                 │   ├─ UPDATE_*            → UpdateContext
                 │   ├─ WINDOW_*            → WindowContext
                 │   └─ (view-level events: skip)
                 │
                 └── Step 2: Relay to ALL iframe views via postMessage
                      │
                      ▼ ViewContext — SINGLE message listener per iframe
                      │
                      └── Routes event to correct handler
                          ├─ theme-changed       → loadTheme()
                          ├─ git-status-changed  → refreshGitStatus()
                          ├─ active-session-changed → loadSession()
                          ├─ active-file-changed → setActiveFile()
                          ├─ fs-change           → reloadFileTree()
                          └─ ...
```

### Dependency Hierarchy

```
Bridge (src/renderer/bridge/) — ONLY layer with window.aynite
  │
  ├──→ Context Providers (AppContext routes events to them)
  │     ├─ ThemeProvider
  │     ├─ UpdateProvider
  │     ├─ WindowProvider
  │     ├─ WorkspaceProvider
  │     ├─ LayoutProvider
  │     └─ UIProvider
  │
  ├──→ Main Renderer Components (consume via useApp())
  │     ├─ TitleBar
  │     ├─ UpdateBanner
  │     └─ App.tsx
  │
  └──→ ViewContext (routes to iframe views)
        └──→ Views (consume via useView() or deprecated useAppEvent())
```

---

## Running the Audit

```bash
npx tsx scripts/audit-bridge-architecture.ts
npx tsx scripts/audit-bridge-architecture.ts --check  # exit code 1 on violations
```
