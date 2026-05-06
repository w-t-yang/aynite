# Refactoring Plan — Complete

All phases completed against the `npm run simplify` baseline (2026-05-06).

## Phase 1 — High Impact, Low Risk

### 1. Delete 52 dead exports ✅
- Removed `export` from view protocol types in `src/lib/constants/view.ts`, payload interfaces in `src/main/*/ipc.ts`
- Later cleaned up truly unused interfaces (ViewRequestDTO, ViewResponseDTO, ViewOperationDTO in view.ts; AiChatResult, AiApprovalRequest, AiApprovalResponse, SystemPromptPayload in ai/ipc.ts; FileEntry, FileInfoResult, FsChangeEvent in file/ipc.ts)

### 2. Collapse 74 repeated Tailwind class combos ✅
- Extracted `SECTION_LABEL` (`text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60`) → `src/renderer/shared/lib/styles.ts`
- Extracted `VIEW_CONTAINER` (`h-screen w-screen overflow-hidden`) → same module
- Applied in ColorPicker, Input, AgentCard, SelectionMenu, aichat-main, settings-main, treeview-main

## Phase 2 — Structural Debt

### 3. Break up AIChat.tsx (782L, C76) ✅
- Extracted 6 components to `components.tsx`: `isErrorMessage`, `ToolCallItem`, `ThoughtBlock`, `ToolResultMessage`, `ApprovalModal`, `SessionsModal`

### 4. Break up Treeview.tsx (759L, C94) ✅
- Extracted `FileNode`, `NodeRenderer`, `PromptModal`, `ConfirmModal` → `components.tsx`
- Extracted `findNodeData`, `updateNodeChildren`, `fetchFiles` → `utils.ts`

### 5. Break up Settings.tsx (414L, C35) ✅
- Already split before baseline — each settings section is its own component (AppearanceTab, KeybindingsTab, AITab, AgentsTab, SkillsTab, CommandsTab, ToolsTab, AboutTab)

### 6. Break up agent.ts runAgentLoop (335L, C40) ✅
- Extracted `prepareMessagesForApi()` → `src/renderer/shared/lib/prepare-messages.ts` (100 lines, pure function)

## Phase 3 — Architecture

### 7. Fix 4 circular dependency cycles ✅
- `config → workspace → file → config` — broke by:
  - Inverting `file/ipc.ts → workspace` dependency via callback parameter in `setupFileIpc(opts?)`
  - Inverting `workspace/ipc.ts → file` dependency via callback in `setupWorkspaceIpc(mainWindow, opts?)`
  - Extracting `getIgnorePatterns` → `config/ignore.ts` with direct imports from consumer modules
  - Removing `router.ts` from config barrel (`index.ts`)
- Result: **4 → 0 cycles**

### 8. Consolidate commands.ts / skills.ts ✅
- Extracted shared `spell-installer.ts`: `getSpellConfig`, `saveSpellConfig`, `listAvailableSpells`, `restoreSpell`, `restoreDefaultSpells`
- commands.ts: 113L → 39L, skills.ts: 109L → 33L

### 9. Review 32 internal-only exports ✅
- Removed `export` from: `AIProvider`, `getAIModel` (factory.ts); `ToolContext`, `createTools` (tools.ts); `getBundledResourcesPath`, `restoreAynitePlaybook` (config/logic.ts); dead re-export `expandHome`
- Removed `export type { AIProvider }` from ai barrel
- Internal-only exports: **47 → 42**

## Phase 4 — Polish

### 10. Address micro-patterns ✅
- **Nested ternaries**: 5 → 1 (remaining is `&&` + ternary false positive: `a && b ? c : d`)
- **`.then()` chains → async/await**: 4 → 0 (TabSwitcher ×3, setupWatcher)
- **`!!` on booleans / `{...props}` spreads**: noted but left as-is (info-level, low impact)

---

## Current Metrics

| Check | Before | After |
|---|---|---|
| Circular dependencies | 4 | **0** |
| Nested ternaries | 5 | 1 (FP) |
| `.then()` chains | 4 | **0** |
| Internal-only exports | 47 | **42** |
| TypeScript errors | 46 | 46 (unchanged) |
| Dead exports | 52 | 18 (false positives only) |
