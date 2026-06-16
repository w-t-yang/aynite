# Test Strategy

## Why Tests?

The project has outgrown its safety net. We are at **307 tests across 19 files**, but large critical areas remain uncovered.

## Current Coverage (as of June 2026)

| Area | Risk | Coverage | Priority | Notes |
|------|------|----------|----------|-------|
| Git porcelain (parsing, hunk patching) | High | 31 tests ✅ | Maintain | Full coverage of 7 status codes, quoted paths, unicode |
| Git status manager (caching, refresh) | High | 10 tests ✅ | Maintain | Coverage includes debounce, cache staleness |
| Git root finding | Medium | 7 tests ✅ | Maintain | Cached directory walker with boundary checks |
| Git commit generation | Low | 3 tests ✅ | Maintain | Error path + happy path |
| Config router (routeGet/SetConfig) | High | 21 tests ✅ | Maintain | Covers all handler dispatch, workspace scoping |
| Schema validation | High | 28 tests ✅ | Maintain | 7 types, nested objects, anyOf, real schemas |
| Constants validation | Very Low | 28 tests ✅ | Maintain | |
| Path utilities | Low | 51 tests ✅ | Maintain | expandHome, isPathWithinDomain, glob |
| Secure file operations | Medium | 16 tests ✅ | Maintain | Domain validation guards |
| Workspace logic | Medium | 18 tests ⚠️ | **P2** | Missing: renameWorkspaceFolder, updateTileData, addWorkspaceFolder edge cases |
| Config handlers (5 files) | High | 0-55% ❌ | **P0** | static-handlers, workspace-state-handlers, ai-handlers, config-file-handlers, telemetry-handlers |
| System logic (view versioning) | High | 10.7% ❌ | **P0** | isVersionLowerThan, restoreViewFromBundle, getAvailableViews |
| AI session lifecycle | High | 0% ❌ | **P0** | saveSession, loadSession, listSessions, deleteSession |
| AI tools (task-manager) | Medium | 11 tests ✅ | Maintain | Task CRUD with real filesystem mock |
| Telemetry (GA4) | Low | 0% ❌ | **P2** | Event batching, session tracking |
| Theme logic | Low | 0% ❌ | **P2** | CRUD operations |
| Spells (skills/commands) | Low | 0% ❌ | **P3** | Installer, folder management |
| RSS logic | Medium | 0% ❌ | **P2** | Feed fetching, bookmarking, summarization |
| Spotify logic | Low | 0% ❌ | **P3** | Auth flow, playback APIs |
| File IPC handlers | Medium | 0% ❌ | **P1** | All CRUD operations through IPC |
| i18n infrastructure | Low | 0% ❌ | **P2** | loadViewTranslations, flattenTranslations |
| Git IPC handlers | Medium | 0% ❌ | **P1** | STAGE_HUNK, DISCARD_HUNK, COMMIT_EXECUTE |
| Window state registry | Medium | 0% ❌ | **P1** | Multi-window workspace isolation |
| Renderer hooks/views | Medium | 0% ❌ | **P3** | useAIChat, useFileModes, GitDiffView |

## Approach

1. **Start with pure logic** — functions that take input and return output (no IPC, no mocks needed) ✅ Done
2. **Then core utilities** — git parsing, path helpers, security wrappers ✅ Done
3. **Then service orchestration** — IPC handlers, config router (need mocking) ⚠️ Partial
4. **Then integration tests** — End-to-end flows (AI session, git commit → status refresh) ❌ Not started
5. **New modules** — Cover i18n, telemetry, version-aware views, remaining services

## File Organization

Tests live in `tests/` mirroring `src/` structure:
```
tests/
├── lib/               # Constants, path utilities, types, secure operations
├── main/
│   ├── config/        # Config router, handlers, schema validation, logic
│   ├── git/           # Porcelain, status manager, root finder, commit-gen, watcher
│   ├── ai/            # Task manager, session lifecycle, tools
│   ├── workspace/     # Workspace CRUD
│   ├── file/          # File IPC handlers (planned)
│   ├── telemetry/     # GA4 events (planned)
│   ├── system/        # View versioning, shell config (planned)
│   ├── theme/         # Theme CRUD (planned)
│   ├── spells/        # Skills/commands (planned)
│   └── window-state/  # Window registry (planned)
├── renderer/
│   ├── src/           # Context providers
│   ├── shared/        # i18n, featured components (planned)
│   └── views/         # Treeview, file-browser, markdown, etc.
```

## Round Plans

| Round | Scope | Status |
|-------|-------|--------|
| **Round 1** | Git porcelain, config router, schema validation, task tools, path/utils | ✅ Complete (307 tests) |
| **Round 2** | Config handlers, window state, AI session, git IPC, workspace gaps, IPC bridge contract | ❌ Not started |
| **Round 5** | System logic (view versioning), i18n, telemetry, RSS, workspace missing functions | ❌ Not started |
| **Round 3** | Renderer component tests (useAIChat, GitDiffView, FileBrowser modes) | ❌ Not started |
| **Round 4** | Integration tests (chat-service, config router, git status cycle, AI tools) | ❌ Not started |

**Note:** Round numbers skip 2→5 because Rounds 2-4 were planned but not started, and significant new modules were added since. The numbering reflects priority order, not chronological sequence.

## Future Direction

- **Round 2 (next)**: Cover the critical untested service layer — config handlers are the router's execution backend, window state powers multi-window, AI session is the most regressed code
- **Round 5**: Cover new modules (i18n, telemetry, view versioning) before they accumulate bugs
- **Round 3**: After backend coverage is solid, move to renderer hooks and view components
- **Round 4**: Integration tests that exercise real I/O through public interfaces
