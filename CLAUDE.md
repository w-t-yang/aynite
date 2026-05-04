# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev                # Start electron-vite dev server with hot reload
npm run build              # Production build (electron-vite)
npm run preview            # Preview production build

# Audit (architecture rule enforcement)
npm run audit:main         # Audit main process for rule violations
npm run audit:ui           # Audit renderer code for rule violations
npm run audit              # Run both audits
npm run test:ai            # Test AI provider configurations

# Platform builds
npm run build:linux        # Build for Linux (all formats)
npm run build:appimage     # Build AppImage only
npm run build:deb          # Build .deb only
npm run build:pacman       # Build pacman package only
npm run build:mac          # Build for macOS
npm run build:win          # Build for Windows

# Versioning
npm run patch-tag          # Bump patch version, push + tags
npm run patch-beta         # Bump prerelease beta, push + tags
```

No TypeScript compiler — the `tsconfig.json` uses `noEmit: true`; electron-vite handles bundling.

No linter or test runner is configured. The audit scripts (`scripts/audit-main.ts`, `scripts/audit-ui.ts`) serve as the primary code quality enforcement. They are run via `tsx` (not `tsc`).

## Architecture

This is an Electron desktop app using `electron-vite` with three build targets: **main**, **preload**, and **renderer**. Context isolation is enabled.

### Main Process (`src/main/`)

Organized into 8 subsystems under `src/main/`:
```
ai/        config/    file/     spells/    system/    theme/    updater/    workspace/
```

Each subsystem follows the same pattern:
- **`logic.ts`** — pure business logic, no Electron imports
- **`ipc.ts`** — registers `ipcMain.handle` / `ipcMain.on` handlers, imports from `logic.ts`
- **`index.ts`** — re-exports the `setup*Ipc()` function (and sometimes logic functions)

The **config subsystem** is special: it has a `router.ts` with key-based dispatch (`routeGetConfig`/`routeSetConfig`). The renderer uses a `ConfigKey` enum to request/set config values, and the router maps each key to the appropriate backend module. This is the primary data access pattern for the newer API.

The entry point `src/main/index.ts` creates the `BrowserWindow` and calls each subsystem's `setup*Ipc()` function. It also handles keybinding dispatch via `before-input-event` → `webContents.send('aynite:app-operation', operation)`.

### Preload (`src/preload/index.ts`)

Exposes typed bridges to the renderer via `contextBridge.exposeInMainWorld`:

- **`window.aynite`** — the current API, typed against the `AyniteWindow` interface in `src/lib/constants/types.ts`. Methods are thin wrappers around `ipcRenderer.invoke`/`send`/`on`.
- **`window.api`** — legacy API, untyped, used only by code under `src/renderer/shared/`. Being consolidated into `window.aynite`.
- **`window.electron`** — exposed raw `ipcRenderer` (unused by renderer, pending removal).

### Renderer (`src/renderer/`)

Split into two layers with different consumers and API usage:

| Directory | API | Role |
|---|---|---|
| `src/renderer/src/` | `window.aynite` | Newer app shell: context providers, config class, view-manager |
| `src/renderer/shared/` | `window.api` | Older shared UI: components, pages, file viewers |
| `src/renderer/views/` | via shared | View-level entry points (aichat, settings, treeview) |

Key files in `renderer/src/`:
- **`config.ts`** — `AyniteConfig` class wrapping `window.aynite.getConfig/setConfig` with typed methods
- **`view-manager.ts`** — `ViewManager` that dispatches `ViewRequest` enum operations, supports listener registration

The **shared directory** has a strict import layer hierarchy enforced by `audit:ui`:
```
lib → basic → featured → pages → views
```
Each layer may only import from layers to its left (lib is lowest, views is highest).

### Shared Library (`src/lib/`)

- **`path.ts`** — Canonical source for all path operations and filesystem I/O. Provides:
  - Path helpers: `getAyniteDir()`, `getWorkspaceDataPath()`, `getAIConfigPath()`, etc.
  - Wrapped `path` functions: `joinPaths()`, `getDirname()`, `getBasename()`, etc.
  - I/O helpers: `readJson()`, `writeJson()`, `readText()`, `writeText()`, `ensureDir()`, `copy()`, `rename()`, `remove()`, etc.
  - Secure variants with domain validation: `secureReadText()`, `secureWriteText()`, etc.
- **`constants/`** — `ai.ts`, `config.ts` (ConfigKey enum), `types.ts` (AyniteWindow interface + shared types), `view.ts` (ViewRequest enum), `themes.ts`, `keybindings.ts`, etc.

### Important Conventions

1. **No direct `fs` or `path` imports** outside `src/lib/path.ts`. All code must use the wrapped helpers from `lib/path.ts` instead. The audit scripts flag violations.
2. **No raw `fs.readFileSync`**, `path.join()`, etc. — use `readJson()`, `joinPaths()`, etc.
3. **Subsystem isolation in main**: external code imports subsystems only through their `index.ts`. Cross-subsystem imports must go through the index barrel.
4. **Shared UI layering**: `lib → basic → featured → pages → views`. No reverse imports.
5. **Config access** from renderer goes through `window.aynite.getConfig/setConfig` with `ConfigKey` — not through direct channel invocations.
6. **IPC channels** use the `aynite:resource-action` naming convention (e.g., `aynite:file-read`, `aynite:workspace-list`). Some legacy channels exist under `aynite:config-load` or `update:*`.
7. The app data directory is `~/.aynite-desktop/`, structured with subdirectories for config, logs, prompts, themes, skills, commands, views, workspaces, sessions.
