# Test Tasks — Round 5

Goal: Cover new modules added after the test strategy was first written — system view versioning, i18n infrastructure, telemetry, RSS, theme, spells, and remaining workspace gaps.

**Status: NOT STARTED**

---

## T-501 — System Logic (View Versioning)

**Risk:** High. The version-aware view loading system is critical for ensuring users get updated views. Wrong version comparison or failed restore could silently serve stale views.

**File to create:** `tests/main/system/logic.test.ts`

**Source:** `src/main/system/logic.ts` — `isVersionLowerThan`, `restoreViewFromBundle`, `validateAndMaybeRestoreView`, `getAvailableViews`, `getShellConfig`

**Approach:** Pure logic functions with mock filesystem for restore operations. `isVersionLowerThan` needs no mocking at all.

**Subtests (12-15):**
1. `isVersionLowerThan` — Same version returns false
2. `isVersionLowerThan` — Patch bump (0.1.5 < 0.1.6)
3. `isVersionLowerThan` — Minor bump (0.1.5 < 0.2.0)
4. `isVersionLowerThan` — Major bump (0.1.0 < 1.0.0)
5. `isVersionLowerThan` — Beta vs release (0.1.0-beta.1 < 0.1.0)
6. `isVersionLowerThan` — Prerelease ordering (0.1.0-beta.1 < 0.1.0-beta.2)
7. `isVersionLowerThan` — Different length parts (0.1 < 0.1.0)
8. `validateAndMaybeRestoreView` — Skips views without aynite-version
9. `validateAndMaybeRestoreView` — Returns true when version matches
10. `validateAndMaybeRestoreView` — Restores from bundle when version is lower
11. `restoreViewFromBundle` — Copies bundled view to runtime directory
12. `restoreViewFromBundle` — Returns false when bundle missing
13. `getAvailableViews` — Returns list of valid views sorted by name
14. `getAvailableViews` — Skips views without index.html
15. `getShellConfig` — Returns Unix shell config on non-Windows
16. `getShellConfig` — Respects SHELL env var on Unix

**Estimated effort:** 25 min

---

## T-502 — i18n Infrastructure

**Risk:** Low. The i18n system is pure transformations with no side effects. Primarily translation loading and key resolution.

**File to create:** `tests/renderer/shared/i18n/i18n.test.ts`

**Source files:**
- `src/renderer/shared/i18n/loadViewI18n.ts` — `loadViewTranslations`, `flattenTranslations`
- `src/renderer/shared/i18n/useI18n.ts` — `resolveTranslation` and `t()` function logic
- `src/renderer/shared/i18n/translations.ts` — Translation dictionary integrity

**Approach:** Pure functions, no mocks needed for `flattenTranslations` and `resolveTranslation`.

**Subtests (8-10):**
1. `flattenTranslations` — Flattens nested object into dot-separated keys
2. `flattenTranslations` — Handles empty object
3. `resolveTranslation` — Returns translation for existing key
4. `resolveTranslation` — Falls back to key name when translation missing
5. `resolveTranslation` — Handles deeply nested keys
6. `loadViewTranslations` — Merges view translations with shared defaults
7. Translation dictionary — All keys have both en and zh entries
8. Translation dictionary — No missing template variables or broken references

**Estimated effort:** 15 min

---

## T-503 — Telemetry (GA4)

**Risk:** Low. Fire-and-forget system with no user-facing impact if it breaks. But tracking loss would be invisible.

**File to create:** `tests/main/telemetry/telemetry.test.ts`

**Source:** `src/main/telemetry/index.ts` — event batching, session tracking, GA4 payload construction

**Approach:** Mock `fetch` for GA4 POST calls. Test in-memory batching logic.

**Subtests (6-8):**
1. Event payload has correct structure (clientId, sessionId, params)
2. Events are batched and flushed on threshold (25 events)
3. Events are flushed on timeout (60 seconds)
4. `startSession` sends `app_start` event
5. `endSession` sends `app_end` event with duration
6. `setTelemetryEnabled(false)` stops event submission

**Estimated effort:** 20 min

---

## T-504 — RSS Logic

**Risk:** Medium. The RSS service handles feed fetching, content management, and summarization. Untested in-memory operations could regress.

**File to create:** `tests/main/rss/logic.test.ts`

**Source:** `src/main/rss/logic.ts` — content storage, read/unread tracking, bookmarking, summarization

**Approach:** Mock filesystem operations for content storage. Test logic paths for bookmark toggle, read tracking, source management.

**Subtests (8-10):**
1. Load content returns articles grouped by source
2. Marking item as read updates state
3. Marking all read for source updates all items
4. Toggle bookmark adds/removes from bookmarks list
5. Fetch feed returns parsed articles (mock rss-parser)
6. Delete source content removes data
7. Delete source removes from source list
8. Summarize sends and stores AI-generated summary

**Estimated effort:** 25 min

---

## T-505 — Theme Logic

**Risk:** Low. Theme CRUD operations are straightforward file operations.

**File to create:** `tests/main/theme/logic.test.ts`

**Source:** `src/main/theme/logic.ts` — `getThemesList`, `getTheme`, `saveTheme`, `deleteTheme`, `initThemes`

**Approach:** Mock `readJson`/`writeJson` at the path utility level.

**Subtests (5):**
1. `getThemesList` — Returns list of available themes
2. `getTheme` — Reads specific theme config
3. `getTheme` — Returns null for missing theme
4. `saveTheme` — Writes theme file
5. `deleteTheme` — Removes theme file

**Estimated effort:** 10 min

---

## T-506 — Spells (Skills/Commands)

**Risk:** Low. Simple file management operations.

**File to create:** `tests/main/spells/logic.test.ts`

**Source files:**
- `src/main/spells/skills.ts` — `getSkillsConfig`, `getAvailableSkills`, skill folder management
- `src/main/spells/commands.ts` — Command listing
- `src/main/spells/common.ts` — `getBundledResourcesPath`, spell restoration

**Approach:** Mock filesystem at the path utility level.

**Subtests (5-6):**
1. `getBundledResourcesPath` — Returns correct path in dev mode
2. `getSkillsConfig` — Returns configured folders
3. `getAvailableSkills` — Lists skills from configured folders
4. Skill folder add — Adds to folder list
5. Skill folder remove — Removes from folder list

**Estimated effort:** 15 min

---

## T-507 — File IPC Handlers

**Risk:** Medium. File operations (create, read, write, rename, copy, delete, watch) are the most commonly used IPC handlers. Any regression breaks the entire file system interaction.

**File to create:** `tests/main/file/ipc-handlers.test.ts`

**Source:** `src/main/file/index.ts` — All `ipcMain.handle(FileChannels.*, ...)` handlers

**Approach:** Mock `fs.promises` operations. Test handler logic and error handling.

**Subtests (10):**
1. LIST — Returns directory entries
2. LIST — Handles non-existent directory
3. READ — Returns file content
4. READ — Handles missing file
5. SAVE — Writes content to file
6. CREATE — Creates file or directory
7. RENAME — Renames file
8. COPY — Copies file
9. DELETE — Removes file
10. WATCH_FILE — Starts/stops file watcher

**Estimated effort:** 30 min

---

## Prioritization

| Priority | Task | Risk | Effort | Why |
|----------|------|------|--------|-----|
| **P0** | T-501 System logic | High | 25 min | Version-aware views affect ALL users on update |
| **P0** | T-507 File IPC handlers | Medium | 30 min | Most commonly used IPC, any regression breaks everything |
| **P1** | T-504 RSS logic | Medium | 25 min | Feed fetching with IO, read tracking |
| **P2** | T-502 i18n infrastructure | Low | 15 min | Pure transformations, low risk |
| **P2** | T-503 Telemetry | Low | 20 min | Fire-and-forget, no user impact if broken |
| **P2** | T-505 Theme logic | Low | 10 min | Straightforward CRUD |
| **P3** | T-506 Spells | Low | 15 min | Simple file management |
