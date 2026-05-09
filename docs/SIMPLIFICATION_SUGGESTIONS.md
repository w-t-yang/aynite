# Simplification Suggestions

Observations and proposals for reducing complexity, written in the spirit of
**Simplicity First** — minimum code that solves the problem, nothing speculative.

---

## 1. Dual IPC Patterns

### Problem

There are **two parallel IPC mechanisms** that do the same thing:

```
Mechanism A: Config Router
  ConfigKey enum → routeGetConfig(key)/routeSetConfig(key) switch → save/load

Mechanism B: Dedicated IPC Channels
  ThemeChannels, WorkspaceChannels, FileChannels, etc. → dedicated ipcMain.handle()
```

Examples of the overlap:

| Operation | Via Config Router | Via Dedicated Channel |
|---|---|---|
| List themes | `getConfig('themes')` → `routeGetConfig(ConfigKey.THEMES)` | `ThemeChannels.LIST` → `setupThemeIpc()` |
| Get workspace list | `getConfig('workspaces')` → `routeGetConfig(ConfigKey.WORKSPACES)` | `WorkspaceChannels.LIST` → `setupWorkspaceIpc()` |
| Get a single theme | `getConfig('theme', id)` → `routeGetConfig(ConfigKey.THEME)` | `ThemeChannels.READ` → `setupThemeIpc()` |
| Save a theme | `setConfig('theme', {id, theme})` → `routeSetConfig(ConfigKey.THEME)` | `ThemeChannels.SAVE` → `setupThemeIpc()` |

The preload exposes **both** paths — `window.aynite.getConfig('themes')` and
`window.aynite.getThemes()` both exist and hit different IPC channels.

The renderer's `AyniteConfig` class (`src/lib/constants/renderer/config.ts`)
uses only the config router path, while the views sometimes use the dedicated
channels directly via `window.aynite`.

### Suggestion

Pick **one** mechanism and remove the other.

- **Option A:** Keep the config router. Delete all dedicated channels
  (`ThemeChannels`, `WorkspaceChannels`, etc.) and route everything through
  `ConfigChannels.GET/SET`. The `ConfigKey` enum becomes the single source of
  truth for what data the renderer can request.

- **Option B:** Keep dedicated channels. Delete the config router
  (`router.ts`, `ConfigKey` enum, `ConfigChannels.GET/SET`). Each domain owns
  its own IPC handlers. The renderer calls `window.aynite.getThemes()` instead
  of `window.aynite.getConfig('themes')`.

**Recommendation: Option A** — fewer files, less indirection, one pattern to
learn. The renderer would call `getConfig(key)` / `setConfig(key, value)` for
everything, with typed wrappers in `AyniteConfig` if desired. The dedicated
channel constants can be removed.

**If Option A is chosen**, the preload can be simplified from ~30 methods to
just `getConfig`, `setConfig`, and a few event listeners.

---

## 2. ConfigRouter Is a Growing Switch Statement

### Problem

`src/main/config/router.ts` contains two switch statements (~120 lines) that
map `ConfigKey` values to backend modules. Every new config key requires:

1. Adding to `ConfigKey` enum
2. Adding a `case` in `routeGetConfig`
3. Adding a `case` in `routeSetConfig`
4. Adding a typed wrapper method in `AyniteConfig` class

This is procedural, not declarative. It will grow linearly with features.

### Suggestion

Replace the switch statements with a **registry pattern**:

```typescript
// src/main/config/registry.ts
type ConfigHandler = {
  get: (payload?: any) => Promise<any>
  set: (payload: any) => Promise<boolean>
}

const configRegistry = new Map<string, ConfigHandler>()

export function registerConfig(key: string, handler: ConfigHandler) {
  configRegistry.set(key, handler)
}

export function routeGetConfig(key: string, payload?: any) {
  const handler = configRegistry.get(key)
  if (!handler) { console.warn(`Unknown key: ${key}`); return null }
  return handler.get(payload)
}

export function routeSetConfig(key: string, payload: any) {
  const handler = configRegistry.get(key)
  if (!handler) { console.warn(`Unknown key: ${key}`); return false }
  return handler.set(payload)
}
```

Each domain registers its own handlers at startup:

```typescript
// src/main/theme/index.ts (at module level or in setupThemeIpc)
registerConfig(ConfigKey.THEMES, {
  get: () => getThemesList(),
  set: () => false, // themes list is read-only
})
registerConfig(ConfigKey.THEME, {
  get: (id) => getTheme(id),
  set: ({ id, theme }) => saveTheme(id, theme),
})
```

This way:
- Each domain owns its config logic — no central switch to maintain
- New config keys don't touch router.ts
- The registry can be tested independently
- Dead config keys are easier to spot (unregistered handlers)

---

## 3. CLAUDE.md Is Out of Sync With the Code

### Problem

The `CLAUDE.md` file describes abstractions and patterns that don't match the
actual codebase:

| CLAUDE.md Says | Code Reality |
|---|---|
| `broadcastAppEvent(type, data)` in `src/main/broadcast.ts` | Doesn't exist. The function is `sendAppEvent(type, data)` in `src/main/window.ts` |
| `AppEventRelay` component mounted in `ThemeProvider` | Doesn't exist. Relaying happens inline in `AppContext.tsx`'s `onAppEvent` handler |
| `useAppEvent(type, handler)` from `shared/lib/appEvents.ts` | Doesn't exist at that path. The hook is `useAppEvent` in `src/renderer/views/ViewContext.tsx` |
| `window.api` and `window.electron` (legacy, being phased out) | Don't exist in the code anymore — appear to already be removed |
| `ViewRequestDTO`/`ViewResponseDTO` protocol with `aynite-view-request` channels | Doesn't exist. Views communicate via `window.aynite` API directly and `postMessage` events |
| `src/lib/constants/view.ts` | File doesn't exist |
| `shared/lib/useTheme.tsx` with `useViewTheme` / `ThemeAwareView` | Doesn't exist. Theme handling is in `ViewContext.tsx` |
| Import layers: `lib → basic → featured → pages → views` | The actual directory has `lib/`, `basic/`, `featured/` directly under `shared/`, no `pages/` directory |

This is dangerous because `CLAUDE.md` is the primary guide for AI agents
working on this codebase. If it describes things that don't exist, agents will
waste time looking for files that aren't there or implement things that are
already done differently.

### Suggestion

**Audit and rewrite CLAUDE.md** to match the actual code. Specifically:

1. Remove or correct descriptions of `broadcastAppEvent` / `AppEventRelay`
2. Remove references to `window.api`, `window.electron`, `view.ts`, `useTheme.tsx`
3. Correct the import layer description (no `pages/` directory)
4. Update the cross-frame communication description to match the real
   `sendAppEvent` → `AppContext.onAppEvent` → `postMessage` → `useAppEvent` flow

Consider generating `CLAUDE.md` from a script that checks each referenced file
exists (or at minimum, add a lint/audit script that validates the doc against
the codebase).

---

## 4. Config Persistence Is Split Across Two Paths

### Problem

Config changes can be persisted via **two different code paths**:

**Path A — Individual save (via `routeSetConfig`):**
```typescript
// Each case in routeSetConfig writes only its own data
case ConfigKey.AI: {
  await writeJson(getAIConfigPath(), { ...existing, ...payload })
  return true
}
```

**Path B — Bulk save (via `saveConfig`):**
```typescript
// Saves AI config, keybindings, main config, and ignore all at once
export async function saveConfig(settings: any) {
  await writeJson(getAIConfigPath(), ai)
  await writeJson(getKeybindingsConfigPath(), keybindings)
  await writeJson(getMainConfigPath(), mainConfig)
  await writeText(getIgnoreConfigPath(), ...)
}
```

This means:
- If someone adds a new config key to `saveConfig()` but forgets to add it to
  `routeSetConfig`, it only works via bulk save
- If someone adds a new config key to `routeSetConfig` but forgets `saveConfig`,
  it only works via individual save
- The renderer's `AyniteConfig` class calls `routeSetConfig` via
  `window.aynite.setConfig()` for individual saves. But `saveConfig` is also
  exposed via `ConfigChannels.SAVE` in the preload.
- The distinction between "bulk save" and "individual save" is unclear —
  `saveConfig` can overwrite data that was set individually between bulk saves.

### Suggestion

Eliminate one path.

- Remove `saveConfig` and `ConfigChannels.SAVE` entirely. All saves go through
  `routeSetConfig`. If the renderer needs to save multiple keys at once, it
  calls `setConfig()` multiple times (IPC is fast enough for this).

- OR: Make `saveConfig` the **only** persistence mechanism, and have
  `routeSetConfig` just update in-memory state. But this requires adding a
  "commit" step, which is more complexity.

**Recommendation:** Remove the bulk save path. It's unused by the renderer
(the `AyniteConfig` class only calls `setConfig` per-key), and the `loadConfig`
function already handles reading individual files. The `ConfigChannels.SAVE`
handler and `saveConfig` function are dead code waiting to confuse someone.

---

## 5. Renderer Layer Architecture

### Problem

The renderer has two parallel directory trees with import layering rules:

```
src/renderer/
  src/         — App shell: contexts, layout, tiles, TitleBar
  shared/      — Components organized by layer
    lib/       → basic/    → featured/
  views/       — Individual iframe views (aichat, settings, treeview)
```

Each view is a standalone micro-app with its own `index.html`, entry point,
and iframe boundary. The `shared/` directory is meant to be shared between
the main renderer and the iframe views.

The layering rules (`lib → basic → featured → views`) add cognitive overhead.
Developers need to remember which layer can import what. The audit script
(`audit:ui`) enforces this, but it's an extra thing to maintain and debug.

Additionally, the `views/` directory has its own `ViewContext.tsx` which lives
**outside** the `shared/` hierarchy but exports hooks used by `shared/`
components (e.g., `FileViewer.tsx` imports `useAppEvent` from `views/ViewContext`).
This violates the layering — a `featured` component (FileViewer) imports from
`views/`.

### Suggestion

**Option A: Merge `shared/lib` into `src/lib`** and treat the constants library
(`src/lib/`) as the single shared layer. Move `utils.ts`, `cn()`, `applyThemeColors()`
into `src/lib/renderer-utils.ts`. Then `shared/` becomes a pure component library
with no layering subdirectories — just `shared/components/` flat.

**Option B: Accept the layering but enforce it correctly.** Move `ViewContext.tsx`
into `shared/` so it's importable by `featured/` components without violating
the rules. Fix the audit script to catch this.

**Recommendation: Option A** — simpler, fewer directories, no rules to remember.
If the component library grows large enough to need layering, add it then.

---

## 6. The `useAppEvent` Hook Has Multiple Implementations

### Problem

The CLAUDE.md describes `useAppEvent` living in `shared/lib/appEvents.ts`, but
in reality it's in `views/ViewContext.tsx`. There are actually **two** hooks
doing similar things:

| Hook | Location | Mechanism |
|---|---|---|
| `useAppEvent(type, callback)` | `views/ViewContext.tsx` | `window.addEventListener('message', ...)` — listens for iframe `postMessage` relay |
| `subscribeToAppEvents` / `useAppEventSubscriber()` | `views/ViewContext.tsx` | Same `message` listener, but returns a callback-based subscription (used by `useAIChat.ts`) |

Meanwhile, the main renderer (`AppContext.tsx`) uses `window.aynite.onAppEvent()`
which listens on the IPC channel directly — a completely different mechanism.

So there are effectively **three** ways to listen for events:
1. Main renderer: `window.aynite.onAppEvent()` → IPC listener
2. Iframe views: `useAppEvent()` → `postMessage` listener
3. Iframe views (non-React): `useAppEventSubscriber()` → `postMessage` listener

### Suggestion

Unify the iframe view hooks:
- Keep `useAppEvent(type, callback)` for React components
- Keep `useAppEventSubscriber()` for non-React code
- But **extract** them from `views/ViewContext.tsx` into a shared location
  (e.g., `src/lib/renderer/app-events.ts`) so they're importable without
  depending on the view provider

And consider whether the `subscribeToAppEvents` pattern in `useAIChat.ts` could
be replaced with the simpler `useAppEvent` pattern, since it's already inside
a React component.

---

## 7. Rediscovery Opportunities

These are smaller items that could each save 50–200 lines of code.

### 7a. Tile System Complexity

The tile system (`src/renderer/src/utils/tile.ts`, `layout/TileNode.tsx`,
`layout/Tile.tsx`, `layout/TileSplitter.tsx`, `layout/TitleBar.tsx`) is
a recursive split-tree layout. It's well-designed for what it does, but:

- The `executeLayoutOperation` function in `tile.ts` is likely a large switch
  statement that mutates a deeply nested tree. This is inherently complex.
- Persistence happens on every change via `useEffect` in `AppContext.tsx`,
  debounced only by `isResizing`.

If this hasn't been a source of bugs, leave it. If it has, consider whether a
simpler layout model (e.g., a grid with fixed positions) would suffice.

### 7b. Settings View Is a Kitchen Sink

`src/renderer/views/settings/` has 11 files covering AI, agents, appearance,
commands, keybindings, skills, tools, folders, about — each as a separate tab.
This is fine but worth watching: if more tabs keep getting added, consider
loading them dynamically from a plugin/registry rather than hardcoding.

### 7c. Dead Code from `saveConfig`

The `saveConfig` function in `src/main/config/logic.ts` and its corresponding
`ConfigChannels.SAVE` IPC handler appear to be unused by the renderer.
A quick search confirms the renderer uses `setConfig()` per-key, never
`saveConfig()`. This can be removed.

### 7d. Config Router Event Broadcasting

The `ConfigChannels.SET` handler in `config/index.ts` broadcasts events after
saving:

```typescript
if (key === ConfigKey.ACTIVE_THEME || key === ConfigKey.THEME) {
  sendAppEvent(AppEvents.THEME_CHANGED, { themeId })
} else if ([AI, AGENTS, PROMPTS, SKILLS, COMMANDS, TOOLS].includes(key)) {
  sendAppEvent(AppEvents.CONFIG_CHANGED, { key })
}
```

This is good — but it's a growing `if/else-if` chain. Consider using the
registry pattern (Suggestion #2) where each handler declares its own
post-save event:

```typescript
registerConfig(ConfigKey.ACTIVE_THEME, {
  get: ...,
  set: async (payload) => {
    await writeJson(...)
    sendAppEvent(AppEvents.THEME_CHANGED, { themeId: payload })
    return true
  }
})
```

---

## Summary

| # | Issue | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | Dual IPC patterns | Confusion, inconsistency | Medium | High |
| 2 | ConfigRouter switch statement | Hard to maintain | Medium | Medium |
| 3 | CLAUDE.md out of sync | Misleads AI agents | Low | **High** |
| 4 | Dual persistence paths | Data inconsistency risk | Low | Medium |
| 5 | Renderer layer complexity | Cognitive overhead | Low | Low |
| 6 | Multiple event hooks | Confusion | Low | Low |
| 7 | Smaller rediscoveries | Varies | Varies | Low |

The highest-impact, lowest-effort change is **#3: fix CLAUDE.md** — it directly
affects how effectively AI agents can work on this codebase. The second highest
is **#1: pick one IPC pattern** to reduce confusion.
