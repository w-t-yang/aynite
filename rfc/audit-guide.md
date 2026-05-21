# Audit Guide

This document describes all audit scripts, their purpose, criticality, and how to use them.

---

## Criticality Levels

| Badge | Meaning |
|-------|---------|
| 🔴 **MANDATORY** | Enforces project-wide architectural rules. Must pass before merge. |
| 🟡 **RECOMMENDED** | Detects potential issues or regressions. Should be clean but not a blocker. |
| 🔵 **INFORMATIONAL** | Analytical/metrics only. No pass/fail — use for refactoring guidance. |

---

## 🔴 `audit:base` — Mandatory (10 checks)

The core rule enforcement suite. **Must pass clean** for all changes.

```bash
npm run audit:base
```

| Check | Rule |
|-------|------|
| `audit:preload` | Preload bridge must not leak Node.js APIs to the renderer |
| `audit:constants` | All `export const` must live in `src/lib/constants/` |
| `audit:types` | All `export interface` / `export type` must live in `src/lib/types/` |
| `audit:window` | Window lifecycle and event wiring architecture |
| `audit:zindex` | Only semantic z-index tokens (`z-base`, `z-layout`, `z-popover`, `z-modal`, etc.) |
| `audit:path` | All filesystem path helpers must be in `src/lib/path.ts` |
| `audit:main-import` | Main process modules must import through subsystem `index.ts` barrels |
| `audit:event` | Inter-process communication follows hub-and-spoke pattern |
| `audit:theme` | Hardcoded colors only allowed in data visualization views (chart palettes, indicator colors, theme preview data) |
| `audit:components` | Raw `<button>` / `<input>` / `<textarea>` only allowed in `shared/basic` and documented view files |

### Strict mode (CI)

```bash
npm run audit:base -- --check
```

Exits with code 1 if any check has violations. Used in CI pipelines.

---

## 🔵 `audit:standalone` — Informational (5 checks)

Analytical scans that flag improvement opportunities. No pass/fail — run when refactoring.

```bash
npm run audit:standalone
```

| Check | What it finds |
|-------|---------------|
| `audit:bridge` | Cross-references preload IPC invocations against main handlers. **Catches missing handlers (runtime crashes) and dead handlers (unused code).** |
| `audit:communication` | Anti-patterns: raw `webContents.send()`, `ipcRenderer.on()` in renderer, inlined IPC channel strings |
| `audit:complexity` | Functions exceeding complexity thresholds (>40 lines, >8 cyclomatic, >4 params flagged high; >25 lines, >5 cyclomatic, >3 params flagged medium) |
| `audit:exports` | Dead exports (never imported), internal-only exports (only consumed within own directory), unnecessary barrel files |
| `audit:patterns` | Micro-pattern simplifications: nested ternaries, `.then()` chains, boolean prop shorthands, prop pass-through, repeated Tailwind class combinations |

### Running individual checks

```bash
npm run audit:bridge       # IPC contract verification
npm run audit:communication
npm run audit:complexity
npm run audit:exports
npm run audit:patterns
```

---

## 🟡 `audit:tools` — Recommended (4 checks)

Third-party tooling for deeper static analysis. Run periodically or before major releases.

```bash
npm run audit:tools
```

| Check | Tool | What it finds |
|-------|------|---------------|
| `audit:duplication` | `jscpd` | Repeated code blocks across the project |
| `audit:circular` | `madge` | Circular dependency chains between modules |
| `audit:ast-grep` | `ast-grep` | Custom AST patterns (configured in `sgconfig.yml`) |
| `audit:deadcode` | `knip` | Unused files, exports, and dependencies |

---

## 🏁 Run everything

```bash
npm run audit:all
```

Runs `audit:base` → `audit:standalone` → `audit:tools` in sequence.

---

## 🔴 CI gate

```bash
npm run audit:check
```

Runs `audit:bridge --check` and `audit:base -- --check` with strict exit codes. This is the CI entry point — any violation blocks the pipeline.

---

## Quick reference

```bash
# Daily workflow
npm run audit:base          # mandatory checks

# Before refactoring
npm run audit:complexity    # find complex functions to simplify
npm run audit:exports       # find dead code to remove

# Before release
npm run audit:tools         # duplication, circular deps, dead code
npm run audit:all           # everything

# CI
npm run audit:check         # strict mode
```
