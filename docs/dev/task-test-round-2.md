# Test Tasks — Round 2

Goal: Cover the next tier of high-risk code — IPC handlers, window state, file operations, and the AI session lifecycle.

---

## T-006 — Window State Registry

**Risk:** Medium. Powers multi-window workspace isolation. Recently added, no tests.

**File to create:** `tests/main/window-state.test.ts`

**Source:** `src/main/window-state.ts` — `registerWindow`, `unregisterWindow`, `getWindowWorkspace`, `setWindowWorkspace`, `onWindowClose`, `getWinIdFromSender`

**Approach:** Pure functions operating on a Map. Mock only `fs.readFileSync` for the synchronous workspace config read in `registerWindow`.

**Subtests:**
1. `registerWindow` — Stores window with workspace, default inheritance from global config
2. `unregisterWindow` — Removes window, fires cleanup callbacks
3. `getWindowWorkspace` — Returns correct workspace for window ID
4. `setWindowWorkspace` — Updates workspace for existing window
5. `onWindowClose` — Registers and fires cleanup callback on unregister
6. `getWinIdFromSender` — Extracts window ID from Electron's `event.sender`
7. Unknown window ID — Returns fallback

**Estimated effort:** 20 min

---

## T-007 — Git Root Finding (findGitRoot)

**Risk:** Medium. Caching layer with potential staleness bugs. Bug 2 in memory (subfolder of git repo) was fixed here.

**File to create:** `tests/main/git/root-finder.test.ts`

**Source:** `src/main/git/index.ts` — `GitService.findGitRoot()` (cached directory walker)

**Approach:** Mock `exists` and `getDirname` to simulate `.git` directory presence at different levels. Test the class method through a minimal instance.

**Subtests:**
1. Finds root when `.git` is in the path directory
2. Finds root by walking up parent directories
3. Returns null for path outside any git repo
4. Uses cached result on subsequent call
5. Handles root boundary (stops at `/`)
6. `clearCaches` — Clears cache entries

**Estimated effort:** 15 min

---

## T-008 — Git IPC Handler Side Effects

**Risk:** Medium. IPC handlers have error handling paths and conditional logic.

**File to create:** `tests/main/git/ipc-handlers.test.ts`

**Source:** `src/main/git/index.ts` — IPC handlers for STATUS, REFRESH_STATUS, HEAD_CONTENT, INDEX_CONTENT, STAGE_HUNK, DISCARD_HUNK, COMMIT_EXECUTE

**Approach:** Mock `execAsync` and `spawnGitPatch`. Test handler logic paths (not git itself).

**Subtests:**
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

## T-009 — File Operations (secure helpers)

**Risk:** Medium. Security wrappers are the gate between AI and filesystem.

**File to create:** `tests/main/file/secure-ops.test.ts`

**Source:** `src/lib/path.ts` — `secureReadText`, `secureWriteText`, `secureEditFile`, `secureListDir`, `secureGrepSearch`, `secureGlobSearch`, `isPathWithinDomain`, `checkIsTextFile`

**Approach:** Pure-ish — mock filesystem at the `exists`, `readText`, `writeText` level. Test domain validation logic.

**Subtests:**
1. `secureReadText` — Reads file within domain
2. `secureReadText` — Returns access denied for outside-domain path
3. `secureWriteText` — Writes within domain
4. `secureWriteText` — Returns access denied for outside-domain
5. `secureEditFile` — Successful replacement
6. `secureEditFile` — Not unique (0 matches)
7. `secureEditFile` — Not unique (multiple matches)
8. `secureListDir` — Lists directory contents
9. `isPathWithinDomain` — Exact match, subdirectory, sibling, tilde expansion, empty path
10. `checkIsTextFile` — Null byte detection, text content

**Estimated effort:** 25 min

---

## T-010 — AI Session Lifecycle

**Risk:** High. 5+ bug fix iterations recorded in memory. Session creation/save/load cycle is the most regressed code in the project.

**File to create:** `tests/main/ai/session.test.ts`

**Source:** `src/main/ai/index.ts`, `src/renderer/views/aichat/services/ChatService.ts`

**Approach:** Session lifecycle is split across main process (save/load) and renderer (ChatService). Main process side is simpler to test. Focus on the file format and edge cases.

**Subtests:**
1. `saveSession` — Writes session JSON with correct structure
2. `loadSession` — Reads session by id + date
3. `loadSession` — Returns null for missing session
4. `listSessions` — Lists all sessions grouped by date
5. `deleteSession` — Removes session file
6. Session file format — Messages array, metadata, timestamps

**Estimated effort:** 20 min

---

## T-011 — IPC Bridge Contract

**Risk:** Medium. Preload→main IPC channels must stay in sync. Currently audited by script, not tests.

**File to create:** `tests/main/ipc-bridge.test.ts`

**Source:** `src/preload/index.ts`, `src/lib/constants/ipc-channels.ts`

**Approach:** Verify that every IPC channel constant has a corresponding handler registered in the main process, and that the preload bridge exposes all expected channels.

**Subtests:**
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

## T-012 — Workspace Logic Edge Cases

**Risk:** Low. Existing tests cover happy paths. Missing edge cases.

**File to update:** `tests/main/workspace/logic.test.ts` (append)

**Source:** `src/main/workspace/logic.ts`

**Subtests:**
1. `deleteWorkspace` — Removes from list (currently untested)
2. `switchWorkspace` — Persists last-used timestamp
3. `getWorkspaceFolders` — Handles missing workspace data
4. `reorderWorkspaceFolders` — Validates folder existence
5. `saveWorkspaceState` — Merges partial state without overwriting existing fields

**Estimated effort:** 15 min

---

## Prioritization

| Priority | Task | Risk | Effort | Why |
|----------|------|------|--------|-----|
| **P0** | T-010 AI session lifecycle | High | 20 min | Most regressed code in project |
| **P0** | T-009 File secure ops | Medium | 25 min | Security boundary for AI tools |
| **P1** | T-006 Window state | Medium | 20 min | Powers multi-window, recently added |
| **P1** | T-007 Git root finding | Medium | 15 min | Cached logic with known bugs |
| **P1** | T-008 Git IPC handlers | Medium | 25 min | Many error paths, untested |
| **P2** | T-011 IPC bridge contract | Low | 15 min | Audited elsewhere but good to automate |
| **P2** | T-012 Workspace edge cases | Low | 15 min | Mostly covered, fill gaps |
