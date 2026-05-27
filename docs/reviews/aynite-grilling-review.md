# Aynite Project Grilling Review

**Date:** June 2026
**Reviewer:** Aynite (self-review)

---

## 1. Conceptual Coherence Check

### 1.1 What Is Aynite?

Aynite is an **AI-native Electron workspace** — not an IDE, not a note-taking app, not a browser, but something that pulls from all three. It gives AI agents direct access to your file system, git repositories, RSS feeds, Spotify, and a suite of data visualizations, all inside a tiled window manager.

**The elevator pitch:** "An operating system for your AI agent."

**Does the codebase reflect this identity?** Mostly yes. The architecture has the right bones:
- **Electron 3-process model** (main/preload/renderer iframes) for isolation of 16+ views
- **AI at the core**, not bolted on — the AI has tool access to read/write files, run commands, and manage tasks
- **Workspace paradigm** centers around folders, not projects or files
- **Multi-window support** was recently added, confirming a "desktop OS" ambition

**One tension:** The app calls itself "beta" but has 15 betas shipped, a playbook workspace, demo data for all 8 dataviews, and production-ready Spotify/RSS integrations. The gap between *maturity of shipped features* and *stability of foundation* is wide.

### 1.2 Domain Language Check

The codebase uses these terms consistently:

| Term | Definition | Consistent? |
|------|-----------|-------------|
| **Tile** | A rectangle in the layout that hosts one view | ✅ |
| **View** | An iframe-loaded component (aichat, file-browser, dataview-*) | ✅ |
| **Workspace** | A named collection of folders, sessions, and layout config | ✅ |
| **Spell** | An AI agent configuration (prompt + model + tools) | ✅ |
| **Skill** | A directory with SKILL.md that teaches the AI to do something | ✅ |
| **DataView** | A visualization view that loads + validates a JSON file | ✅ (renamed late in dev but done) |
| **FileView** | A specialized viewer for a file type (PDF, image, audio, video) | ✅ (recently extracted) |
| **Aynite** | The app name AND the default agent name | ⚠️ Collision |

**The Aynite/Aynite collision:** The user's name is Aynite, the app is Aynite, and the default AI agent is Aynite. That's three things with the same name. In conversation this is fine ("Aynite the app runs Aynite the agent for Aynite the user"), but in code there are places where "aynite" refers to the app, the config path, the protocol scheme, and the playbook. This isn't a bug — it's a deliberate branding choice — but it means any future disambiguation (e.g., offering multiple agents with different names) will need to untangle this.

---

## 2. Architecture Assessment

### 2.1 Strengths

**A. Exceptional separation of concerns between processes.**
The Electron 3-process model is used correctly:
- **Main process** owns files, git, config, AI model calls — all privileged operations
- **Preload** is a thin bridge (no business logic leaked)
- **Renderer** is isolated in iframes per view, with `postMessage` for cross-view communication
- The IPC channel constants in `src/lib/constants/ipc-channels.ts` are a single source of truth shared across all three layers

**B. The window-state architecture (multi-window) is well-designed.**
The per-window state registry (`window-state.ts`) is clean. Each window independently tracks its workspace, file, and sessions. Events are scoped correctly:
- Global events (theme, config, updates) → broadcast
- Per-window events (active file, AI chat deltas) → scoped
- The `registerWindow/unregisterWindow` pattern with cleanup callbacks is production-grade

**C. Skill + Command system is genuinely extensible.**
The SKILL.md convention is simple but powerful. Skills live in directories at `~/.aynite/skills/`, are restored from bundled resources, and are loaded at app init. The "transform-to-dataview" skill is a good example of what this enables — a skill that transforms raw data into a visualization.

**D. The audit tooling is impressive.**
10 base audits (preload, constants, types, window, z-index, path, main-import, event, theme, components) plus standalone audits (bridge, communication, complexity, exports, patterns) plus tool audits (duplication, circular deps, ast-grep rules, dead code) — this is more structured quality enforcement than most production apps have.

**E. Strategic use of refactoring.**
The codebase shows clear refactoring patterns:
- God modules being split (path.ts → resolve/fs/secure was identified in the previous review, and the memory shows partial adoption)
- Naming conventions being enforced (DataView prefix, FileView extraction)
- Performance issues being fixed (memoization, stable callbacks, useRef patterns)

### 2.2 Weaknesses

**A. Config Router (`router.ts`) is still a god module.**
The previous architecture review identified this as the #1 candidate, and it remains the most pressing architectural debt. The file grows with every new feature that needs config. Currently handles ~20 config keys across 10+ domains.

**B. God components in the renderer.**
`AppContext.tsx` (~400 lines) and `FileBrowserPage.tsx` (~400 lines) manage too many cross-cutting concerns. The `userModeRef` pattern in `FileBrowserPage` is a clear symptom — an async effect and UI controls fighting over the same state because they aren't cleanly separated.

**C. Test coverage is thin.**
Only 4 test files exist (2 in `tests/lib/`, 2 in `tests/main/`). For a project with:
- 16 views
- 8 dataviews with custom rendering logic
- AI agent loop with tool execution
- Git integration with hunk patching and commit generation
- RSS with summarization
- Spotify OAuth + API integration

…the test suite is dangerously insufficient. Most bugs are found and fixed reactively (the memory shows 10+ bug fix entries).

**D. The AI agent loop is fragile.**
The `ChatService` + `useAIChat` + `agent.ts` architecture has been through at least 5 iterations (stale closures, race conditions, session misrouting, multi-tile readiness). The fact that it took this many fixes suggests the abstractions aren't right yet. The current architecture (ChatService singleton + React hook thin wrapper) is better, but the session management layer still feels over-engineered for what it does.

**E. Technical debt in path.ts splitting.**
The previous review recommended splitting `src/lib/path.ts` (560 lines, 3 concerns) into separate modules. The current code still has it as one file. This is a high-leverage, low-risk refactor that hasn't been done yet.

---

## 3. Code Quality Observations

### 3.1 What's Done Well

**TypeScript usage is disciplined.**
- Types are centralized in `src/lib/types/` (not scattered)
- Enums/constants in `src/lib/constants/` are clean
- The `ConfigKey` enum prevents string-typo bugs
- Generic patterns like the DataView naming convention show deliberate thought

**Error handling is generally good.**
Main process handlers have try/catch with proper error propagation. The protocol handler for `aynite-resource://` correctly handles Range requests for media streaming.

**Performance-conscious patterns.**
The memory documents specific performance fixes:
- Memoized syntax highlighting in DiffViewer
- Content-based dependency comparison to prevent infinite re-render loops
- Stable callback references via useRef
- Concurrent call guards in GitDiffView

### 3.2 What Needs Work

**Test debt is the most urgent.**
The existing tests are mostly utility-level (path resolution, constants). Nothing tests:
- The AI agent loop end-to-end
- Git status parsing
- Hunk staging/discard logic
- Dataview rendering
- IPC handler correctness
- The session lifecycle (create → save → load → delete)

This is a risk multiplier: every refactor of router.ts, path.ts, or git/index.ts is done without a safety net.

**Dead code and orphan files.**
The `docs/` directory has files like `REFACTORING_PLAN.md`, `SIMPLIFICATION_SUGGESTIONS.md`, `THEME_PROPAGATION.md`, `TYPE_REFACTOR_PLAN.md` that may be outdated or orphaned. The previous cleanup (removing CLAUDE.md, .stylelintrc.json, typecheck_output.txt) was good — a similar pass over `docs/` would help.

**Circular dependency risk.**
With the config router being imported by so many modules, and those modules potentially importing config-related types, there's risk of circular dependencies. The madge-based audit exists but it's unclear if it runs clean.

---

## 4. Feature Completeness Assessment

### 4.1 Well-Established Features

| Feature | Status | Notes |
|---------|--------|-------|
| **AI Chat** | ✅ Mature | Multi-provider, streaming, tool execution, approval flow |
| **Git Integration** | ✅ Mature | Status, diff, staging, commit generation, auto-refresh |
| **File Browser** | ✅ Mature | Tabs, edit/view/fileview modes, search with highlighting |
| **RSS Reader** | ✅ Mature | Feeds, groups, bookmarks, summarization, "Today" view |
| **Spotify** | ✅ Functional | Auth, browsing, playback, playlists |
| **8 DataViews** | ✅ Mature | Chart, stock, graph, flow, diagram, mindmap, canvas, theme |
| **Workspace System** | ✅ Mature | Multi-workspace, per-window state, folder management |
| **Theme System** | ✅ Mature | Dynamic CSS variables, 6 built-in themes, theme editor |
| **Spells (Agents)** | ✅ Mature | Multiple agent configs, prompt management |
| **Skills** | ✅ Mature | SKILL.md convention, bundled + user-installable |

### 4.2 Partial / In-Progress Features

| Feature | Status | Notes |
|---------|--------|-------|
| **Keybindings** | 🔶 Partial | UI to view/configure exists, but coverage across views is uneven |
| **Commands** | 🔶 Partial | Working for hello-command and stock commands, but the ecosystem is small |
| **Multi-Window** | 🔶 Recent | Core architecture is done, but UI for managing multiple windows is minimal |
| **AI Browser** | 🔶 Basic | Exists as a view but seems less developed than other features |
| **Slides** | 🔶 Partial | A demo deck exists in playbook, but no dedicated view yet |

### 4.3 Missing / Not Yet Started

| Feature | Status | Notes |
|---------|--------|-------|
| **Search across workspace** | ❌ Missing | Search is per-file only (Ctrl+F in file browser) |
| **Extensions / Plugin API** | ❌ Missing | Skills/Commands are the closest thing, but no formal extension system |
| **Collaborative features** | ❌ Missing | Single-user desktop app by design |
| **Mobile companion** | ❌ Missing | Out of scope for desktop |
| **Backup / sync** | ❌ Missing | No cloud sync or automatic backup mechanism |

---

## 5. Risk Assessment

### 5.1 High Risk

| Risk | Likelihood | Impact |
|------|-----------|--------|
| **Regression from refactoring** (no test safety net) | Medium | High |
| **Config router becoming unmaintainable** (grows with every feature) | High | Medium |
| **Session management bugs regressing** (5+ fixes already) | Medium | High |

### 5.2 Medium Risk

| Risk | Likelihood | Impact |
|------|-----------|--------|
| **Electron version churn** (42.x, vite 8) | Low | High |
| **Path.ts touching too many modules** (refactor is high-touch) | High | Low |
| **AI provider SDK changes** (4 SDKs, all evolving) | Medium | Medium |

### 5.3 Low Risk

| Risk | Likelihood | Impact |
|------|-----------|--------|
| **view naming convention drift** (DataView vs FileView vs plain View) | Low | Low |
| **Dead code in docs/** | High | Very Low |

---

## 6. Recommendations

### Priority 1 — Test Coverage (Highest ROI)

Start with: **Git status parsing + hunk operations** (most complex, most regressions in memory), then **AI session lifecycle** (most bugs fixed), then **Config router handlers**.

Target: ~40-50% coverage on main process logic within 2 weeks.

### Priority 2 — Split Config Router

Implement the handler registry pattern recommended in the previous review. This is a mechanical refactor that can be done incrementally:
1. Add `registerGetHandler(prefix, fn)` / `registerSetHandler(prefix, fn)` to router.ts
2. Extract one domain at a time (start with `activeSessionId` → AI module)
3. Keep the old switch as fallback during migration
4. Delete switch cases as modules register

### Priority 3 — Split path.ts

Pure mechanical split into `resolve.ts` (path getters), `fs.ts` (I/O wrappers), `secure.ts` (validated operations). High-touch but low-risk. Can be automated with a codemod.

### Priority 4 — Split AppContext into Composed Contexts

Create `WorkspaceContext`, `ThemeContext`, `UpdateContext`, `WindowContext`, `TileContext`. Compose them in a `Providers.tsx`. Each consumer imports only what it needs.

### Priority 5 — Add CI Pipeline

The quality control document already specifies exactly what's needed. Start with `lint` + `test` + `typecheck` on push/PR. This is the single highest-leverage investment for preventing regressions.

---

## 7. Verdict

**Aynite is not a toy project.** It's a serious, production-quality Electron application with 15 shipped betas, a coherent architectural vision, and disciplined engineering practices. The codebase has been through genuine design iterations (session management took 5+ fixes, file watching went through 4 tiers, dataview naming was standardized late).

The weakest point is **test coverage** — the app has outgrown its ability to be safely refactored without a test suite. The config router and path.ts are the most visible architectural debts. Everything else is solid, well-thought-out, and shipping.

**Grade: B+** — Shipping real value, with known debt that's been identified but not yet addressed. The foundations are strong enough to support continued growth, but test coverage needs to catch up before the debt compounds.

---

*Generated by Aynite (self-review) using the grill-with-docs skill.*
