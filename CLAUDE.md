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

# Standalone (browser-only, no Electron)
npm run dev:standalone     # Vite dev server for standalone mode
npm run build:standalone   # Audit + build standalone + copy to ~/.aynite

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

No TypeScript compiler — `tsconfig.json` uses `noEmit: true`; electron-vite handles bundling.

No linter or test runner. Audit scripts (`scripts/audit-main.ts`, `scripts/audit-ui.ts`) enforce architecture rules via `tsx`.

## Architecture

This is an Electron desktop app using `electron-vite` with three build targets: **main**, **preload**, and **renderer**. Context isolation is enabled. There is also a **standalone** build variant (`vite.standalone.config.ts`) that runs the renderer and views in a browser without Electron — used for quick UI iteration.

### Main Process (`src/main/`)

8 subsystems, each following the same pattern: `logic.ts` (pure logic, no Electron imports) → `ipc.ts` (registers handlers) → `index.ts` (re-exports).

```
ai/        — AI chat, provider factory, tools, prompts, session management
config/    — Config loader/saver + router for key-based get/set dispatch
file/      — File system operations + chokidar-based watcher
spells/    — User-installable skills and commands from resources/
system/    — Font listing, external URLs, dialogs, window controls, clipboard
theme/     — Theme CRUD
updater/   — electron-updater integration
workspace/ — Workspace CRUD, folder management, file scanning
```

**Entry point** `src/main/index.ts` creates the BrowserWindow, calls each subsystem's `setup*Ipc()`, and handles keybinding dispatch via `before-input-event` → `webContents.send('aynite:app-operation', operation)`.

**Config subsystem** (`config/`): has a `router.ts` with key-based dispatch (`routeGetConfig`/`routeSetConfig`). The renderer uses a `ConfigKey` enum to request/set config values, and the router maps each key to the appropriate backend module (e.g., `ConfigKey.WORKSPACE` routes to workspace module, `ConfigKey.AI` reads/writes `.aynite/config/ai.json`). This is the primary data access pattern.

**AI subsystem** (`ai/`):
- `factory.ts` — `getAIModel()` creates an `ai-sdk` `LanguageModel` from a provider config. Supports OpenAI, Anthropic, Google/Gemini, DeepSeek, Ollama, and any OpenAI-compatible provider.
- `chat.ts` — `handleAiChat()` runs the streaming chat loop, sends deltas via IPC to renderer.
- `prompts.ts` — Merges global prompts (about-me, about-skills, etc.) and agent prompts (AYNITE, VOID, ALPHA, etc.) into a system prompt.
- `tools.ts` — Metadata for AI-accessible tools (read_file, write_file, grep_search, run_command, etc.).

**Spells subsystem** (`spells/`): manages user-installable skills and commands loaded from `resources/` (packaged) or `~/.aynite/` (user). Skills and commands are pluggable modules that extend the app's capabilities.

### IPC Pattern

All channel constants live in `src/lib/constants/ipc-channels.ts`, organized by domain:

```
ConfigChannels, ConfigEventChannels   → aynite:config-*
FileChannels, FileEventChannels       → aynite:file-*
WorkspaceChannels                     → aynite:workspace-*
AiChannels, AiEventChannels           → aynite:ai-*
SpellChannels                         → aynite:spell-*
SystemChannels                        → aynite:system-*
UpdateChannels                        → aynite:update-*
ThemeChannels                         → aynite:theme-*
```

Event channels (e.g., `FS_CHANGE`, `CHAT_DELTA_PREFIX`, `APP_OPERATION`) use `ipcRenderer.on` / `webContents.send` for push notifications. Request channels use `ipcMain.handle` / `ipcRenderer.invoke`.

### Preload (`src/preload/index.ts`)

Exposes `window.aynite` via `contextBridge` — a typed API covering config, file ops, workspace, AI chat (including streaming delta listeners and approval requests), system, updates, and spells. Also exposes `window.api` (legacy, used only by `shared/`, being phased out) and `window.electron` (raw ipcRenderer, pending removal).

### Renderer (`src/renderer/`)

Split into two layers:

| Directory | API | Role |
|---|---|---|
| `src/renderer/src/` | `window.aynite` | App shell: context providers, config class, tile layout, view-manager |
| `src/renderer/shared/` | `window.api` | Older shared UI: components, pages, file viewers |
| `src/renderer/views/` | via shared | View entry points (aichat, settings, treeview) — each has an `index.html` + `.tsx` entry |

Key files in `renderer/src/`:
- **`config.ts`** — `AyniteConfig` class wrapping `window.aynite.getConfig/setConfig` with typed methods
- **`App.tsx`** — Root component: `ThemeProvider > AppProvider > TileNode + TitleBar`
- **`context/AppContext.tsx`** — Core state: workspace config, layout management, tile operations, resize handling. Listens for `onAppOperation` to dispatch keyboard-driven layout commands
- **`context/ThemeContext.tsx`** — Loads themes, applies CSS custom properties to `:root`, manages `data-theme` attribute
- **`layout/`** — `TileNode.tsx`, `Tile.tsx`, `TileSplitter.tsx`, `TitleBar.tsx` — recursive split-tree layout system

The **shared directory** has a strict import layer hierarchy enforced by `audit:ui`:
```
lib → basic → featured → pages → views
```
Each layer may only import from layers to its left (lib is lowest, views is highest).

### View Management Protocol

Views (in `src/renderer/views/`) communicate via a request/response protocol defined in `src/lib/constants/view.ts`:
- `ViewRequestDTO` — typed request with method (`ViewRequest` enum) and optional payload
- `ViewResponseDTO` — typed response with result or error
- `ViewOperationDTO` — push operations (theme changes, file changes, etc.)
- Channels use the `aynite-view-request` / `aynite-view-response` IPC convention

### Shared Library (`src/lib/`)

- **`path.ts`** — Canonical source for all path operations and filesystem I/O. No direct `fs` or `path` imports allowed outside this file.
  - Path helpers: `getAyniteDir()`, `getWorkspaceDataPath()`, `getAIConfigPath()`, etc.
  - Wrapped Node.js `path` functions: `joinPaths()`, `getDirname()`, `getBasename()`, etc.
  - I/O helpers: `readJson()`, `writeJson()`, `readText()`, `writeText()`, `ensureDir()`, `copy()`, `rename()`, `remove()`, etc.
  - Secure variants with domain validation: `secureReadText()`, `secureWriteText()`, etc.
- **`constants/`** — `ai.ts` (default providers, agent definitions, prompts, tool metadata), `config.ts` (ConfigKey enum), `types.ts` (shared types: workspace, layout, theme, keybinding, file node), `view.ts` (ViewRequest enum + DTO types), `ipc-channels.ts` (all channel name constants), `themes.ts`, `keybindings.ts`, `workspace.ts` (default workspace config), `settings.ts`, `app.ts`, `messages.ts` (error messages)

### Layout / Tile System

The app uses a recursive split-tree layout model:
- `SplitNode` — divides space horizontally or vertically with percentage-based children
- `LeafNode` — a content pane (view/content identified by `content` string, optional `url` for iframes)
- Layouts are persisted per workspace in `~/.aynite-desktop/workspaces/`

Operations (split, close, focus, navigate) are dispatched via keyboard shortcuts through `before-input-event` → `executeAppOperation` → `executeLayoutOperation()`.

### Resources Directory

```
resources/
  aynite-playbook/   — Default workspace content (onboarding/getting started)
  skills/            — Bundled skill definitions (plugable AI capabilities)
  commands/          — Bundled command definitions (custom slash commands)
```

User-installable skills and commands live under `~/.aynite/skills/` and `~/.aynite/commands/`.

### Important Conventions

1. **No direct `fs` or `path` imports** outside `src/lib/path.ts`. All code must use the wrapped helpers from `lib/path.ts`. Audit scripts flag violations.
2. **No raw `fs.readFileSync`**, `path.join()`, etc. — use `readJson()`, `joinPaths()`, etc.
3. **Subsystem isolation in main**: external code imports subsystems only through their `index.ts`. Cross-subsystem imports must go through the index barrel.
4. **Shared UI layering**: `lib → basic → featured → pages → views`. No reverse imports.
5. **Config access** from renderer goes through `window.aynite.getConfig/setConfig` with `ConfigKey` — not through direct IPC invocations.
6. **IPC channels** use the `aynite:resource-action` naming convention (e.g., `aynite:file-read`, `aynite:workspace-list`). All channel strings are defined in `ipc-channels.ts`.
7. **App data directory** is `~/.aynite-desktop/`, with subdirectories for config, logs, prompts, themes, skills, commands, views, workspaces, sessions.
8. **AI streaming**: The `ai` package's `streamText` is used for chat. Deltas are forwarded to the renderer via `webContents.send` on a per-request channel (`aynite:ai-chat-delta:<requestId>`). Tool calls and approvals go through `AiEventChannels.APPROVAL_REQUEST` / `APPROVAL_RESPONSE`.
9. **Theme injection**: Themes are CSS custom properties set on `document.documentElement` by `ThemeContext`. The `data-theme` attribute tracks light/dark mode.
10. **Keybinding dispatch**: Main process caches keybinding config and matches `before-input-event` against it. On match, sends `aynite:app-operation` to the renderer. The renderer's `AppContext.executeAppOperation()` calls `executeLayoutOperation()` from `utils/tile`.
