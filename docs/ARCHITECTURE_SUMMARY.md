# Aynite — Architecture Summary

*A curated reading of `CLAUDE.md`*

---

## Overview

This repository is an **Electron desktop application** named **Aynite**, built with **electron-vite**. It has three build targets: **main**, **preload**, and **renderer**, plus a **standalone** browser-only variant for rapid UI iteration. Context isolation is enabled.

---

## Commands — Three Categories

| Category | Key Scripts |
|---|---|
| **Development** | `npm run dev` (hot reload), `npm run build`, `npm run preview` |
| **Audit** | An extensive suite of structural checks: layer violations (`audit:ui`, `audit:main`, `audit:bridge`), complexity, dead code, circular dependencies, duplication, micro-patterns, and more |
| **Test & Lint** | Vitest for tests, Biome for linting, `tsc --noEmit` for type checks |
| **Platform Builds** | `build:linux`, `build:mac`, `build:win`, plus `standalone` for browser iteration |

---

## Architecture — The Three Processes

### 1. Main Process (`src/main/`)

Eight subsystems, each following the pattern: `logic.ts` → `ipc.ts` → `index.ts`:

| Subsystem | Role |
|---|---|
| **ai/** | AI chat, provider factory (OpenAI, Anthropic, Google, DeepSeek, Ollama, etc.), streaming, tool dispatch |
| **config/** | Key-based config router (`ConfigKey` enum routes to backend modules) |
| **file/** | Filesystem operations with chokidar watcher |
| **spells/** | Pluggable user-installable skills and commands |
| **system/** | Fonts, dialogs, window controls, clipboard |
| **theme/** | Theme CRUD |
| **updater/** | `electron-updater` integration |
| **workspace/** | Workspace CRUD and folder management |

### 2. Preload (`src/preload/index.ts`)

Exposes `window.aynite` via `contextBridge` — a typed API for all subsystems. Also exposes legacy `window.api` and (soon-to-be-removed) `window.electron`.

### 3. Renderer (`src/renderer/`)

Two UI layers with **strict import hierarchy**:

| Directory | Role |
|---|---|
| `src/renderer/src/` | App shell (context providers, config class, tile layout system, view-manager) |
| `src/renderer/shared/` | Older shared UI components, layered: `lib → basic → featured → pages → views` (no reverse imports) |
| `src/renderer/views/` | View entry points (aichat, settings, treeview), each with its own `index.html` |

---

## Key Design Patterns

- **IPC Pattern**: All channel constants in `src/lib/constants/ipc-channels.ts`. Event channels use `webContents.send`, request channels use `ipcMain.handle`.
- **Cross-frame Communication**: Main process uses `broadcastAppEvent()` → main renderer relays via `postMessage` → iframes receive via `useAppEvent()` hook.
- **Theme System**: CSS custom properties on `:root`. Light/dark via `data-theme`. Views self-apply via `ThemeAwareView`. Changes broadcast through `ConfigEventChannels.THEME_CHANGED`.
- **Layout / Tile System**: Recursive split-tree model (`SplitNode` / `LeafNode`), persisted per workspace.
- **Config Access**: Renderer uses `window.aynite.getConfig/setConfig` with typed `ConfigKey` enum — never direct IPC.
- **No Raw `fs` or `path`**: All filesystem operations go through `src/lib/path.ts` wrapped helpers.

---

## Conventions & Constraints

1. **Pure logic separation** in main process — `logic.ts` files have zero Electron imports.
2. **Barrel exports** — subsystems import each other only through `index.ts`.
3. **AI streaming** uses the `ai` package's `streamText`, with deltas forwarded per-request via IPC.
4. **Keybinding dispatch** happens in main process, cached from config, matched against `before-input-event`.
5. **App data** lives at `~/.aynite-desktop/` with structured subdirectories for every concern.

---

## In Essence

This is a **meticulously architected** Electron app with rigorous conventions around import layers, IPC boundaries, filesystem access, and AI streaming — all enforced by a comprehensive audit system. The design emphasizes **modularity** and **separation of concerns** above all else.
