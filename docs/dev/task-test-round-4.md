# Test Tasks — Round 4

Goal: Integration tests that exercise real code paths end-to-end through public interfaces.

---

## T-017 — ChatService Integration (Session Lifecycle)

**Risk:** High. The session lifecycle (create → send → save → load → delete) spans main + renderer processes. The 5+ bug fixes targeted race conditions at these boundaries.

**File to create:** `tests/main/ai/chat-service-int.test.ts`

**Scope:** Main process session operations accessed through `ai/index.ts`:
- `saveSession(workspace, id, messages)` → writes to disk
- `loadSession(workspace, id, date)` → reads from disk
- `listSessions(workspace)` → enumerates session files
- `deleteSession(workspace, id)` → removes file

**Approach:** Use a temporary directory with real filesystem operations. No mocks — test the actual JSON file I/O.

**Subtests:**
1. Save → Load cycle preserves messages
2. Save → List shows session in correct date group
3. Save → Delete → Load returns null
4. Multiple sessions in same date group listed correctly
5. Session file has correct JSON structure (messages array, metadata, timestamps)
6. Empty messages array is valid (clearChat edge case)
7. Concurrent save/load doesn't corrupt data

**Estimated effort:** 25 min

---

## T-018 — Config Router Integration

**Risk:** High. The router is the god module. We have unit tests with mocks — now test with real config files.

**File to create:** `tests/main/config/router-int.test.ts`

**Scope:** `routeGetConfig` and `routeSetConfig` with a temporary `.aynite` directory.

**Approach:** Create a temp `.aynite` dir with minimal config files. Use `fs.mkdtempSync` + `fs.writeFileSync` for setup. Mock only `electron.app`.

**Subtests:**
1. VERSION — Returns electron app version
2. ACTIVE_THEME — Read/write cycle preserves value
3. ACTIVE_FILE — Atomic update (file + openedFiles in one call)
4. ACTIVE_FILE — Setting to null clears both fields
5. ACTIVE_SESSION_ID — Read/write cycle
6. KEYBINDINGS — Write then read returns same data
7. OPENED_FILES — Write array, read back

**Estimated effort:** 30 min

---

## T-019 — Git Status Refresh Cycle

**Risk:** Medium. The `refreshStatus` → `parsePorcelain` → `broadcastAppEvent` cycle is the core of git auto-refresh.

**File to create:** `tests/main/git/status-cycle-int.test.ts`

**Scope:** `GitService.refreshStatus` + `.git watcher` in a real temp git repo.

**Approach:** Create a temp directory, `git init`, make changes, call `refreshStatus`, verify the status map is correct.

**Subtests:**
1. `refreshStatus` detects modified file after edit
2. `refreshStatus` detects untracked file
3. `refreshStatus` returns empty after commit
4. Debounce delays rapid successive calls
5. Status change triggers GIT_STATUS_CHANGED event broadcast

**Estimated effort:** 20 min

---

## T-020 — AI Tool Execution (End-to-End)

**Risk:** Medium. Task tools are tested in isolation with mocks. Verify they work with real filesystem.

**File to create:** `tests/main/ai/tools-int.test.ts`

**Scope:** `createTools(context)` → tool execute functions using a temp workspace directory.

**Approach:** Create temp workspace with `artifacts/` dir. Create minimal `ToolContext`. Test task tools write real files.

**Subtests:**
1. `create_task` → creates real task.md on disk
2. `update_task` → modifies task.md in place
3. `get_tasks` → reads back task.md content
4. `propose_plan` → creates implementation_plan.md with correct format
5. `initialize_memory` → creates memory.md with project info

**Estimated effort:** 20 min

---

## Prioritization

| Priority | Task | Risk | Effort | Why |
|----------|------|------|--------|-----|
| **P0** | T-017 ChatService integration | High | 25 min | Most regressed area, real I/O tests catch file format bugs |
| **P0** | T-018 Config router integration | High | 30 min | Router refactor needs real I/O safety net |
| **P1** | T-019 Git status cycle | Medium | 20 min | Core git feature, tests are straightforward |
| **P2** | T-020 AI tool execution | Medium | 20 min | Builds on T-005 unit tests |

Note: Integration tests are SLOWER but catch bugs that mocks can't (file format drift, encoding issues, permission errors). Run them separately from unit tests: `npm run test:int` or tag them with `--tag=integration`.
