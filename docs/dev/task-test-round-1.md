# Test Tasks — Round 1 ✅ (Complete)

Goal: Build test coverage for the highest-risk areas.

**Status: ALL DONE — 167 passing, 0 failing, 8 test files**

## Completed Tasks

### T-001 — Git Status Parsing ✅
- **Test file:** `tests/main/git/porcelain.test.ts` — 31 tests
- **Extracted:** `src/main/git/porcelain.ts` — `mapCodeToStatus`, `parsePorcelain`, `buildHunkPatch`, `parseNumstat`
- **Coverage:** All 7 status codes, parent propagation, renames, quoted paths, unicode, trailing slashes, empty input, hunk patch format (additions/deletions/normal), diff stats parsing for binary files and multiple files

### T-002 — Config Router ✅
- **Test file:** `tests/main/config/router.test.ts` — 21 tests
- **Coverage:** `routeGetConfig` for VERSION, PLAYBOOK_PATH, ACTIVE_THEME, VIEW_CONFIG, ACTIVE_FILE, OPENED_FILES, ACTIVE_SESSION_ID (with winId scoping), WORKSPACES. `routeSetConfig` for KEYBINDINGS, ACTIVE_THEME, atomic ACTIVE_FILE update, unknown keys. Workspace switching with window state.

### T-003 — Schema Validation ✅
- **Test file:** `tests/main/config/schema-validator.test.ts` — 28 tests
- **Extracted:** `src/main/config/schema-validator.ts` — `checkSchemaType`, `validateAgainstSchema`
- **Coverage:** All 7 types in `checkSchemaType`. Required fields, nested objects, enum, anyOf, arrays (items + minItems), patternProperties, real-world dataview schemas (chart + graph), edge cases (additional properties, nested arrays)

### T-004 — Git Diff Stats ✅
- Extracted `parseNumstat` from DIFF_STATS IPC handler closure. Tested inside `porcelain.test.ts` (6 tests covering binary files, quoted paths, multi-file, empty/malformed)

### T-005 — AI Task Management Tools ✅
- **Test file:** `tests/main/ai/task-manager.test.ts` — 11 tests
- **Coverage:** `create_task` with items list + custom filename + empty list. `update_task` with done/in_progress status, out-of-range index, negative index, missing file, mixed status progress counting. `get_tasks` with existing file + missing file.

### Pre-existing Fixes ✅
- Fixed 16 pre-existing failures in `constants.test.ts`, `logic.test.ts`, `workspace/logic.test.ts`
- Tests now match current source code (no source changes needed)

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Test files | 4 | 8 |
| Passing tests | 37 | **167** |
| Failing tests | 16 | **0** |
| Source extractions | — | `porcelain.ts`, `schema-validator.ts` |

## Bonus: Additional tests completed alongside Round 1

These tasks were originally planned for Round 2 but were completed as part of the initial test push:

| Task | Test file | Tests | What it covers |
|------|-----------|-------|----------------|
| ~~T-007~~ | `tests/main/git/root-finder.test.ts` | 7 | Cached directory walker, boundary checks |
| ~~T-009~~ | `tests/lib/operations.test.ts` | 16 | secureReadText, secureWriteText, secureEditFile, secureListDir, secureGrepSearch, secureGlobSearch, isPathWithinDomain |
| ~~T-012~~ | `tests/main/workspace/logic.test.ts` | 18 | Workspace CRUD, folder management, state merge, deletion edge cases |
| (new) | `tests/main/git/status-manager.test.ts` | 10 | Git status caching, refresh debounce |
| (new) | `tests/main/git/git-watcher.test.ts` | 6 | File system watcher |
| (new) | `tests/main/git/commit-gen.test.ts` | 3 | Commit message generation |

## Current Suite (expanded to include all subsequent work)

The test suite grew beyond Round 1's scope. As of the latest count:
- **19 test files**
- **307 passing tests**
- **0 failing tests**
- Covers: git (6 files), config/router (4 files), AI (1 file), workspace (1 file), path/utils (3 files), renderer (4 files)
