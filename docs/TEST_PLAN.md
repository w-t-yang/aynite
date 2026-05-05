# Test Infrastructure Plan

## Status: ✅ Active

The codebase has zero test infrastructure. All changes are verified manually.
This document tracks the plan to add systematic test coverage.

## Phase 1: Core logic unit tests (Vitest, Node.js mode)

Test modules that have zero Electron/browser dependencies and can run
directly in Node.js via Vitest.

| Module | Priority | Files |
|---|---|---|
| `src/lib/path.ts` | P0 | I/O helpers, path resolution, domain validation | ✅ 24 tests |
| `src/lib/constants/` | P0 | Config enums, type constants, default values | ✅ 30 tests |
| `src/main/config/logic.ts` | P1 | Config load/save/merge, ignore patterns, bundled resources | ✅ 15 tests |
| `src/main/workspace/logic.ts` | P1 | Workspace CRUD logic | ✅ 14 tests |
| `src/lib/types/` | P1 | Type guard functions, validation | ❌ Not started |

## Phase 2: Renderer unit tests (Vitest + happy-dom)

Test React components and hooks with a DOM environment.

| Module | Priority | Files |
|---|---|---|
| `src/renderer/shared/lib/` | P1 | Utility functions, theme helpers |
| `src/renderer/shared/basic/` | P2 | Basic components (Button, Input, Modal, Section) |
| `src/renderer/shared/featured/` | P2 | Featured components (SettingsPage, ColorInput, etc.) |

## Phase 3: Integration tests

Test IPC boundaries with mocked Electron.

| Module | Priority | Files |
|---|---|---|
| Config router (`config/router.ts`) | P2 | Route dispatch logic |
| AI chat handler | P2 | With mocked LLM and tool execution |

## Running tests

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Run with coverage report
npm run test:unit       # Core logic tests only (lib + main, no renderer)
```

## CI Integration

Tests run before the audit check:

```bash
npm test && npm run audit:check
```
