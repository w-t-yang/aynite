# Test Strategy

## Why Tests?

The project has outgrown its safety net. We have:
- 4 test files for a complex Electron app with 16 views, AI agent loop, git integration, RSS, Spotify
- 10+ regression bugs recorded in project memory (many in git, session management, file browser)
- A config router that grows with every feature — no tests means any refactor is done blind

## Target Coverage Areas

| Area | Risk | Current Coverage | Priority |
|------|------|-----------------|----------|
| Git operations (status parsing, hunk patching, root finding) | High — 10+ bugs found | None | **P0** |
| Config router (routeGetConfig / routeSetConfig) | High — god module, grows with every feature | None | **P0** |
| AI session lifecycle (create, save, load, delete) | High — 5+ fix iterations | None | **P1** |
| Tool execution (create_task, run_command shell, file ops) | Medium | None | **P1** |
| Workspace logic (CRUD, folder management, state merging) | Medium | Partial (has tests) | **P2** |
| Path utilities | Low — mostly pure functions | Good | **Maintain** |
| Constants validation | Very Low | Good | **Maintain** |

## Approach

1. **Start with pure logic** — functions that take input and return output (no IPC, no mocks needed)
2. **Then core utilities** — git parsing, path helpers, security wrappers
3. **Then service orchestration** — IPC handlers, config router (need mocking)
4. **Then integration tests** — End-to-end flows (AI session, git commit → status refresh)

## File Organization

Tests live in `tests/` mirroring `src/` structure:
```
tests/
├── lib/           # Constants, path utilities, types
├── main/
│   ├── config/    # Config router, logic
│   ├── git/       # Git operations
│   ├── ai/        # AI tools, chat
│   └── workspace/ # Workspace CRUD
```
