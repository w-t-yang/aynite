# Developer Guide

This guide is for contributors who want to build, test, and understand the Aynite codebase.

---

## Architecture Overview

Aynite uses Electron's **3-process model**:

```
┌─────────────────────────────────────────────────────┐
│                   Main Process                      │
│  Files, Git, Config, AI Model calls, Themes,        │
│  RSS, Spotify, Window management, Updater           │
├─────────────────────────────────────────────────────┤
│                   Preload Bridge                    │
│         Thin IPC layer — no business logic          │
├─────────────────────────────────────────────────────┤
│            Renderer (iframes per view)              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│  │ Chat │ │ Files│ │ RSS  │ │Chart │ │ ...  │       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘       │
│         postMessage communication                   │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Views are isolated** — Each view runs in its own iframe, communicating via `postMessage`. This means views cannot interfere with each other.
- **AI at the core** — The AI agent has direct tool access to read/write files, run commands, and manage tasks. It's not a bolted-on chat window.
- **Window-scoped state** — Each window independently tracks its workspace, active file, and sessions. Multi-window support was built into the architecture from the ground up.
- **Local-first** — All data (sessions, RSS caches, Spotify data, themes, configs) is stored as plain files under `~/.aynite/`.

### Directory Structure

```
src/
├── lib/                    # Shared code (types, constants, path resolution)
│   ├── constants/          # Config keys, IPC channels, layout, keybindings
│   ├── path/               # Path resolution + secure file I/O wrappers
│   └── types/              # TypeScript interfaces (WindowSession, AIProvider, etc.)
├── main/                   # Electron main process
│   ├── ai/                 # AI provider factory, chat loop, tools
│   ├── config/             # Config router, handler registry, schema validation
│   ├── file/               # File operations, watchers
│   ├── git/                # Git status, diff, commit generation, porcelain parsing
│   ├── spells/             # Skill & command discovery and management
│   ├── rss/                # RSS feed fetching, caching, summarization
│   ├── spotify/            # Spotify OAuth, API calls, data caching
│   ├── theme/              # Theme loading, CSS variable injection
│   ├── system/             # Custom protocol handler, system operations
│   ├── updater/            # Auto-update logic
│   └── workspace/          # Workspace CRUD, folder management
├── preload/                # IPC bridge (thin — no business logic)
└── renderer/               # UI layer
    ├── shared/             # Reusable components (Button, Modal, Input, etc.)
    ├── src/                # App shell (contexts, layout engine, tile management)
    └── views/              # 16 standalone views (each in its own iframe)
        ├── aichat/         # AI Chat
        ├── ai-browser/     # AI Browser
        ├── file-browser/   # File Browser (with FileViews)
        ├── rss/            # RSS Reader
        ├── spotify/        # Spotify Player
        ├── settings/       # Settings panel
        ├── treeview/       # File tree
        ├── workspace-view/ # Workspace dashboard
        └── dataview-*/     # 8 DataViews (chart, stock, graph, flow, diagram, mindmap, canvas, theme)
```

---

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **Git** (for git integration features)

---

## Development

### Setup

```bash
git clone https://github.com/w-t-yang/aynite.git
cd aynite
npm install
```

> ⚠️ **Electron runtime not installed?** In some cases `npm install` may skip or fail to download the Electron binary. If you get errors about missing Electron modules, run the following to install the runtime manually:
> ```bash
> node ./node_modules/electron/install.js
> ```

### Running in Development Mode

```bash
npm run dev
```

This starts the Electron app with hot-reload for the main process (builds only — no auto-restart) and serves renderer views from the built output. Press **`Ctrl+R`** to refresh a tile after source changes.

> **Note:** Vite's file watcher for the renderer is disabled in dev mode (to prevent AI agent file operations from triggering HMR). You'll need to manually refresh tiles to see renderer changes.

### Building for Production

```bash
npm run build
```

This runs:
1. `build:views` — Bundle all 16 views with Vite
2. `electron-vite build` — Build main + preload + renderer shell

### Platform-Specific Builds

```bash
npm run build:mac      # macOS (.zip)
npm run build:win      # Windows (.exe via NSIS)
npm run build:linux    # Linux (AppImage)
```

### Docker/Podman on macOS

If you're building Linux targets on macOS, use the provided docker-based build:

```bash
# Build AppImage
npm run build:appimage

# Build deb
npm run build:deb

# Build pacman
npm run build:pacman
```

---

## Testing

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run test:unit     # Unit tests only (lib/ and main/)
```

### Current Test Coverage

The project has 235+ passing tests across 16 test files, covering:

| Area | Tests | What's Tested |
|------|-------|---------------|
| Git porcelain | 31 | Status parsing, hunk building, numstat parsing |
| Schema validator | 28 | Type checking, validation, edge cases |
| Config router | 21 | Route dispatching, workspace-scoped keys |
| Path module | 7 | Path resolution, domain validation |
| Path operations | 15 | Security boundary enforcement |
| AI task tools | 11 | Create/update/get tasks |
| Handler registry | 7 | Register/dispatch contract |
| Git root finder | 7 | Directory walking, caching |
| Git status manager | 10 | Refresh, broadcast, debounce, cache |
| Git watcher | 6 | Setup/teardown, callback invocations |
| Commit gen | 3 | Function existence, error paths |
| Config logic | ~30 | Workspace config, bundled resources |
| Workspace logic | ~15 | Add/remove folders |
| Renderer contexts | 8 | Context hook exports, provider nesting |
| Constants | ~30 | Config keys, app operations, layouts |

### Writing Tests

Tests use Vitest with Electron mocking:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('module name', () => {
  it('should do something specific', () => {
    // Arrange
    // Act
    // Assert
  })
})
```

---

## Linting & Quality

```bash
npm run lint              # Biome check
npm run lint:fix          # Auto-fix
npm run audit:all         # Run all audits
npm run audit:base        # Run 10 base audits (preload, constants, types, etc.)
npm run typecheck         # TypeScript type checking
```

### Audit Suite

The audit suite enforces code quality rules:

| Audit | What It Checks |
|-------|---------------|
| **Preload audit** | No business logic in preload |
| **Constants audit** | No magic strings — all constants centralized |
| **Types audit** | All interfaces in `src/lib/types/` |
| **Window audit** | No `BrowserWindow` import outside `window.ts` |
| **Z-index audit** | No hardcoded z-index values |
| **Path audit** | No raw `path.join` outside `path/` module |
| **Main import audit** | Proper module boundaries |
| **Event audit** | Event names centralized |
| **Theme audit** | No hardcoded colors |
| **Components audit** | No raw HTML tags |

---

## Project Conventions

### Naming

- **DataViews**: Prefix `DataView*` — `DataViewChart`, `DataViewGraph`
- **FileViews**: Prefix `FileView*` — `FileViewAudio`, `FileViewImage`
- **Config keys**: `ConfigKey.XXX` enum in `src/lib/constants/config.ts`
- **IPC channels**: String enums in `src/lib/constants/ipc-channels.ts`

### Architecture Rules

1. **Main process** is the only layer that imports `BrowserWindow` (via `src/main/window.ts`)
2. **Preload** contains zero business logic — only IPC forwarding
3. **Types** live in `src/lib/types/` — never in renderer or main code
4. **Constants** (magic strings, numbers) live in `src/lib/constants/`
5. **Path resolution** goes through `src/lib/path/` — no direct `path.join` outside it

### Git Convention

Commits follow conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`

---

## Release Process

### Creating a Release

```bash
npm run patch-beta   # Bump prerelease version (e.g., 1.0.0-beta.15 → 1.0.0-beta.16)
```

This:
1. Runs `npm version prerelease --preid=beta`
2. Pushes the commit and tag to GitHub
3. The GitHub Actions workflow (`release.yml`) builds and publishes to GitHub Releases

### Version Format

Current: `1.0.0-beta.15` — pre-release beta. Stable release will drop the `-beta.N` suffix.

---

## RFC Process

Significant architectural changes start as an RFC in `rfc/`. See existing RFCs:

- `rfc/communication-architecture.md` — IPC event system design
- `rfc/session-manager-architecture.md` — AI session management
- `rfc/audit-guide.md` — Quality audit system

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run tests (`npm test`) and lint (`npm run lint`)
5. Commit using conventional commits
6. Push and open a Pull Request

### What We Need Help With

- **Test coverage** — Adding tests for uncovered areas (see Testing section)
- **Documentation** — Improving guides, adding tutorials
- **View development** — New dataviews, fileviews, and integrations
- **Platform support** — Windows and Linux testing
- **Bug reports** — Open an issue with reproduction steps
