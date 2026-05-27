# Test Tasks — Round 3

Goal: Cover the renderer layer — component behavior, hooks, and view integration.

---

## T-013 — GitDiffView Component Logic

**Risk:** Medium. Performance fixes applied (memo, infinite loop guard). No tests.

**File to create:** `tests/renderer/featured/GitDiffView.test.tsx`

**Source:** `src/renderer/shared/featured/GitDiffView.tsx`

**Subtests:**
1. Renders changed files list from status prop
2. Refresh button calls loadGitStatus
3. File click triggers onSelectFile callback
4. Folders header shows when showFolderHeaders=true
5. Empty state when no changes
6. Commit flow — generate + execute button states

**Estimated effort:** 30 min (needs jsdom + React Testing Library setup)

---

## T-014 — useAIChat Hook

**Risk:** High. 5+ bug iterations. Session routing, stale closures, race conditions.

**File to create:** `tests/renderer/aichat/hooks/useAIChat.test.ts`

**Source:** `src/renderer/views/aichat/hooks/useAIChat.ts`

**Subtests:**
1. `sendMessage` — Creates new session when none active
2. `sendMessage` — Routes to active session
3. `clearChat` — Clears messages and session ID
4. `ACTIVE_SESSION_CHANGED` — Loads session when switched
5. Session enforcement — Reroutes to visible session when config diverges

**Estimated effort:** 35 min (needs ChatService mock + React renderHook)

---

## T-015 — ToolPartRenderer

**Risk:** Medium. Complex rendering logic with collapsible sections, truncation, streaming output.

**File to create:** `tests/renderer/aichat/components/Message.test.tsx`

**Source:** `src/renderer/views/aichat/components/Message.tsx`

**Subtests:**
1. Renders tool name + arguments
2. Truncates long output
3. Shows executing state with progress
4. Collapsible sections expand/collapse
5. Run command shows real-time streaming output

**Estimated effort:** 25 min

---

## T-016 — FileBrowserPage Mode Switching

**Risk:** Medium. The `userModeRef` pattern was a fix for a race condition. Fragile.

**File to create:** `tests/renderer/file-browser/FileBrowserPage.test.tsx`

**Source:** `src/renderer/views/file-browser/FileBrowserPage.tsx`

**Subtests:**
1. Opens file in fileview mode (markdown → MarkdownView)
2. Switches to edit mode
3. Switches to view mode
4. Git diff mode shows when file has changes
5. User mode override persists after async git check (the `userModeRef` behavior)
6. Search bar toggles with Ctrl+F
7. Close tab removes file from opened files

**Estimated effort:** 40 min (most complex component)

---

## Prioritization

| Priority | Task | Risk | Effort | Why |
|----------|------|------|--------|-----|
| **P1** | T-014 useAIChat hook | High | 35 min | Most regressed code, session routing bugs |
| **P1** | T-016 FileBrowserPage modes | Medium | 40 min | Complex mode logic with known race fix |
| **P2** | T-013 GitDiffView | Medium | 30 min | Performance-sensitive, infinite loop fix |
| **P2** | T-015 ToolPartRenderer | Medium | 25 min | Truncation + streaming, visually critical |

Note: Renderer tests need `jsdom` environment and `@testing-library/react`. The vitest config uses `environment: 'node'` — may need a separate config section for renderer tests or a DOM-compatible test setup.
