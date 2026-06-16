# Test Tasks — Round 2

Goal: Cover the critical untested service layer — config handlers, window state, AI session lifecycle, and git IPC handlers.

**Status: NOT STARTED**

---

## T-006 — Config Handlers

**Risk:** High. The config router dispatches to these handlers, but only the router itself is tested. All handler edge cases (missing files, invalid payloads, version checks) are uncovered.

**File to create:** `tests/main/config/handlers.test.ts`

**Source files:**
- `src/main/config/handlers/static-handlers.ts` — version, playbook-path, view-config, matching-views, language
- `src/main/config/handlers/workspace-state-handlers.ts` — activeFile, openedFiles, activeSessionId, tile-data
- `src/main/config/handlers/ai-handlers.ts` — ai, agents, prompts config
- `src/main/config/handlers/config-file-handlers.ts` — keybindings, views, skills, commands, tools
- `src/main/config/handlers/telemetry-handlers.ts` — telemetry config

**Approach:** Mock `readJson`/`readText` at the path utility level. Test each handler's get/set methods directly through the registry. Focus on:
- Static handlers: version comparison for view-config (aynite-version checks), language fallback
- Workspace-state handlers: atomic activeFile + openedFiles update, winId scoping
- AI handlers: default fallbacks, data repair
- Config-file handlers: read/write for keybindings, views
- Telemetry handlers: read/write telemetry config

**Subtests (20-25):**
1. `staticHandlers.get('version')` — Returns app version
2. `staticHandlers.get('view-config')` — Returns null when config missing
3. `staticHandlers.get('view-config')` — Returns null when aynite-version missing
4. `staticHandlers.get('view-config')` — Returns config when version matches
5. `staticHandlers.get('view-config')` — Triggers restore when version is lower
6. `staticHandlers.get('language')` — Returns saved language
7. `staticHandlers.get('language')` — Falls back to detectSystemLanguage when missing
8. `staticHandlers.set('activeTheme', ...)` — Writes to mainConfig
9. `staticHandlers.set('language', ...)` — Writes language
10. `workspaceStateHandlers.get('activeFile')` — Returns from workspace state
11. `workspaceStateHandlers.get('activeFile')` — Returns null when not set
12. `workspaceStateHandlers.get('openedFiles')` — Returns empty array default
13. `workspaceStateHandlers.get('activeSessionId')` — Returns from workspace state
14. `workspaceStateHandlers.get('activeSessionId', _, winId)` — Resolves through window state
15. `workspaceStateHandlers.set('activeFile', path)` — Atomic update with openedFiles
16. `workspaceStateHandlers.set('activeFile', null)` — Clears both fields
17. `aiHandlers.get('ai')` — Returns AI config
18. `aiHandlers.get('agents')` — Returns agents config with default repair
19. `configFileHandlers.get('keybindings')` — Returns keybindings config
20. `telemetryHandlers.get('telemetry')` — Returns telemetry config
21. `telemetryHandlers.set('telemetry', { enabled: true })` — Updates telemetry config

**Estimated effort:** 40 min

---

## T-007 — Window State Registry

**Risk:** Medium. Powers multi-window workspace isolation. Recently added, no tests.

**File to create:** `tests/main/window-state.test.ts`

**Source:** `src/main/window-state.ts` — `registerWindow`, `unregisterWindow`, `getWindowWorkspace`, `setWindowWorkspace`, `onWindowClose`, `getWinIdFromSender`

**Approach:** Pure functions operating on a Map. Mock only `fs.readFileSync` for the synchronous workspace config read in `registerWindow`.

**Subtests (7):**
1. `registerWindow` — Stores window with workspace, default inheritance from global config
2. `unregisterWindow` — Removes window, fires cleanup callbacks
3. `getWindowWorkspace` — Returns correct workspace for window ID
4. `setWindowWorkspace` — Updates workspace for existing window
5. `onWindowClose` — Registers and fires cleanup callback on unregister
6. `getWinIdFromSender` — Extracts window ID from Electron's `event.sender`
7. Unknown window ID — Returns fallback

**Estimated effort:** 20 min

---

## T-008 — AI Session Lifecycle

**Risk:** High. 5+ bug fix iterations recorded in project memory. Session creation/save/load cycle is the most regressed code in the project.

**File to create:** `tests/main/ai/session.test.ts`

**Source:** `src/main/ai/index.ts` — saveSession, loadSession, listSessions, deleteSession

**Approach:** Mock JSON file operations. Test the file format and edge cases — the actual I/O is tested in the integration round.

**Subtests (8):**
1. `saveSession` — Writes session JSON with correct structure (messages, metadata, timestamps)
2. `loadSession` — Reads session by id + date
3. `loadSession` — Returns null for missing session
4. `listSessions` — Lists all sessions grouped by date
5. `listSessions` — Handles empty sessions dir
6. `deleteSession` — Removes session file
7. Session file format — Validates JSON structure invariants
8. Empty messages array is valid (clearChat edge case)

**Estimated effort:** 20 min

---

## T-009 — Git IPC Handlers

**Risk:** Medium. IPC handlers have error handling paths and conditional logic for hunk staging, commit execution, and status refresh.

**File to create:** `tests/main/git/ipc-handlers.test.ts`

**Source:** `src/main/git/index.ts` — IPC handlers for STATUS, REFRESH_STATUS, HEAD_CONTENT, INDEX_CONTENT, STAGE_HUNK, DISCARD_HUNK, COMMIT_EXECUTE

**Approach:** Mock `execAsync` and `spawnGitPatch`. Test handler logic paths (not git itself).

**Subtests (10):**
1. STATUS — Returns cached status when available
2. STATUS — Triggers refresh when cache empty
3. HEAD_CONTENT — Returns git show output
4. HEAD_CONTENT — Returns null when file not tracked
5. INDEX_CONTENT — Falls back from index to HEAD
6. STAGE_HUNK — Builds patch and applies
7. STAGE_HUNK — Returns error for non-git path
8. DISCARD_HUNK — Same pattern
9. COMMIT_EXECUTE — Stages and commits
10. COMMIT_EXECUTE — Rejects empty message

**Estimated effort:** 25 min

---

## T-010 — Workspace Logic Gaps

**Risk:** Low. Existing tests (18 tests) cover happy paths. Missing edge cases in recently added functions.

**File to update:** `tests/main/workspace/logic.test.ts` (append)

**Source:** `src/main/workspace/logic.ts`

**Untested functions:**
- `renameWorkspaceFolder` — Iterates all workspace configs, updates matching folder paths
- `updateTileData` — Deep tree traversal to update leaf node data
- `addWorkspaceFolder` — Partial: missing "is_parent_of_existing" and "is_child_of_existing" cases

**Subtests (5):**
1. `renameWorkspaceFolder` — Updates exact match old path to new path
2. `renameWorkspaceFolder` — Updates subpath match (folder renamed, child paths updated)
3. `updateTileData` — Updates leaf node data by tile ID
4. `addWorkspaceFolder` — Replaces parent when adding a parent of existing folders
5. `addWorkspaceFolder` — Returns child-of-existing when new path is under existing

**Estimated effort:** 15 min

---

## T-011 — IPC Bridge Contract

**Risk:** Low. Preload→main IPC channels must stay in sync. Currently audited by script, not tests.

**File to create:** `tests/main/ipc-bridge.test.ts`

**Source:** `src/preload/index.ts`, `src/lib/constants/ipc-channels.ts`

**Approach:** Verify that every IPC channel constant has a corresponding handler registered in the main process.

**Subtests (9):**
1. All ConfigChannels have handlers
2. All FileChannels have handlers
3. All GitChannels have handlers
4. All AiChannels have handlers
5. All SpellChannels have handlers
6. All SystemChannels have handlers
7. All RssChannels have handlers
8. All SpotifyChannels have handlers
9. All ThemeChannels have handlers

**Estimated effort:** 15 min

---

## Prioritization

| Priority | Task | Risk | Effort | Why |
|----------|------|------|--------|-----|
| **P0** | T-006 Config handlers | High | 40 min | Router's execution backend, 5 untested files |
| **P0** | T-008 AI session lifecycle | High | 20 min | Most regressed code in project |
| **P1** | T-007 Window state | Medium | 20 min | Powers multi-window, recently added |
| **P1** | T-009 Git IPC handlers | Medium | 25 min | Many error paths, untested |
| **P2** | T-010 Workspace gaps | Low | 15 min | Mostly covered, fill gaps |
| **P2** | T-011 IPC bridge contract | Low | 15 min | Audited elsewhere but good to automate |

## Items Completed Outside Round 2

The following tasks were originally planned in Round 2 but were completed as part of earlier work:
- ~~T-007 Git root finding~~ → `tests/main/git/root-finder.test.ts` (7 tests) ✅
- ~~T-009 Secure file operations~~ → `tests/lib/operations.test.ts` (16 tests) ✅  
- ~~T-012 Workspace edge cases (original)~~ → `tests/main/workspace/logic.test.ts` (18 tests) — delete, folder CRUD, state merge ✅
