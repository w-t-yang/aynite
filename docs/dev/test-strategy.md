# Test Strategy

## Why Tests?

The project has grown its safety net significantly. We are at **551 tests across 33 files** and **36.16% line coverage**. The highest-risk modules (git, config, workspace, window-state, theme) now have strong coverage, but large areas remain — particularly renderer components and AI tool execution.

## Current Coverage (as of June 2026)

| Area | Stmts | Branch | Priority | Notes |
|------|-------|--------|----------|-------|
| **git/** | 68.75% | 62.19% | Maintain | porcelain 98.5%, root-finder 94.4%, status-manager 90.6% |
| **config/** | 56.33% | 56.28% | Maintain | router/handler-registry/ignore/schema-validator all at 100% |
| **config/handlers/** | 66.93% | 59.67% | **P1** | static-handlers at 47.6%, workspace-state at 52.6% |
| **workspace/** | 94.57% | 83.33% | Maintain | Only renameWorkspaceFolder and updateTileData gaps |
| **window-state/** | 100% | 92.85% | Maintain | |
| **theme/** | 97.36% | 100% | Maintain | Only 1 uncovered line |
| **rss/** | 72.93% | 54.87% | **P2** | fetchArticleText, summarizeArticle, fetchAll uncovered |
| **system/** | 64.28% | 56.60% | **P1** | execInUserShell, getSystemFonts, getBundledViewsDir uncovered |
| **ai/chat.ts** | 46.57% | 42.85% | **P1** | aiChat streaming, reasoning options uncovered |
| **ai/tools/** | 22.5% | 8.45% | **P1** | file-ops 6.6%, run-command 2.4%, task-manager 77.4% |
| **spells/** | 28.8% | 20.89% | **P3** | commands/common/installer at 0% |
| **file/** (IPC) | 14 tests ✅ | — | Maintain | All IPC handlers tested |
| **lib/path/** | 36.79% | 30.52% | **P2** | operations.ts 32.8%, resolve.ts 43.9% (many pure functions, tested indirectly) |
| **shared/i18n/** | 87.87% | 76% | Maintain | |
| **shared/basic/** | 1.76% | 0% | **P3** | React components (need jsdom) |
| **shared/featured/** | 0% | 0% | **P3** | GitDiffView, DiffViewer, SelectionMenu (need jsdom) |
| **spotify/** | 0% | 0% | **P3** | Complex auth flow, hard to mock |
| **window.ts** | 5.1% | 0% | **P3** | Electron BrowserWindow operations |

## Round Completion Status

| Round | Scope | Tests | Status |
|-------|-------|-------|--------|
| **Round 1** | Git porcelain, config router, schema validation, task tools, path/utils | 167 | ✅ Complete |
| **Round 2** | Config handlers, window state, AI session, git IPC, workspace gaps, IPC bridge | 139 | ✅ Complete |
| **Round 3** | Renderer component tests (useAIChat, GitDiffView, FileBrowser modes) | 15 | ⚠️ Partial (pure logic only) |
| **Round 4** | Integration tests (chat-service, config router, git status, AI tools) | 5 | ⚠️ Partial (chat-service only) |
| **Round 5** | System logic, i18n, telemetry, RSS, theme, spells, file IPC | 114 | ✅ Complete |

**Total: 551 tests, 33 files, 36.16% line coverage**

## Future Direction (Priority Order)

### P1: Medium effort, high impact (estimated +100 tests)

1. **AI tool execution** (`main/ai/tools/`) — file-ops.ts, run-command.ts are the most security-critical code paths. 22.5% coverage is dangerously low for the gate between AI and filesystem.
   - `file-ops.ts` (6.6%): test readFile/writeFile/editFile/globSearch/grepSearch through the tool execution layer
   - `run-command.ts` (2.4%): test command construction, shell config, output handling
   - `ai/chat.ts` (46.5%): test aiChat stream handling, reasoning options, tool call flow

2. **Config handler gaps** — static-handlers.ts (47.6%) and workspace-state-handlers.ts (52.6%) need coverage for `matching-views`, `tile-data`, `session-delete` edge cases.

3. **System logic** (`main/system/logic.ts`) — execInUserShell, getSystemFonts, getBundledViewsDir are untested.

### P2: Lower effort, incremental (estimated +50 tests)

4. **RSS logic** — summarizeArticle (AI summarization), fetchArticleText (URL fetching), fetchAll (batch fetch) are untested.

5. **lib/path operations.ts** — secureGlobSearch, secureGrepSearch, checkIsTextFile have lower coverage. Many functions are indirectly covered through integration tests.

6. **lib/path resolve.ts** — path resolution functions are pure but coverage is low because they're used as mocks in other tests. Add direct tests.

### P3: Needs jsdom setup (large effort, estimated +200 tests)

7. **Renderer components** — All `shared/basic/` (13 components) and `shared/featured/` (14 components) are at 0%. This includes:
   - GitDiffView, DiffViewer, SelectionMenu, SettingsModal
   - All basic UI components (Button, Modal, Input, Switch, Tooltip, etc.)
   - Requires jsdom + @testing-library/react setup

8. **Spotify** — Complex auth flow and API integration. Lowest priority.

9. **Spells installer** — `spell-installer.ts` is the remaining uncovered spells file.

## File Organization

Tests live in `tests/` mirroring `src/` structure:
```
tests/
├── lib/               # Constants, path utilities, types, secure operations
├── main/
│   ├── config/        # Config router, handlers, schema validation, logic
│   ├── git/           # Porcelain, status manager, root finder, commit-gen, watcher
│   ├── ai/            # Task manager, session lifecycle, tools (chat-service int)
│   ├── workspace/     # Workspace CRUD
│   ├── file/          # File IPC handlers
│   ├── telemetry/     # GA4 events
│   ├── system/        # View versioning, shell config
│   ├── theme/         # Theme CRUD
│   ├── spells/        # Skills/commands
│   ├── window-state/  # Window registry
│   └── ipc-bridge/    # IPC channel constants validation
├── renderer/
│   ├── src/           # Context providers
│   ├── shared/        # i18n
│   └── views/         # Treeview, file-browser, markdown, modes
```
