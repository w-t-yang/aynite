#!/usr/bin/env tsx
/**
 * Bridge Architecture Compliance Audit
 *
 * Enforces the architectural rules defined in RFC-003 (Typed Bridge Architecture).
 * Scans the renderer and view code for violations of the centralized event routing
 * and dependency hierarchy rules.
 *
 * Rules enforced:
 *   1. No `window.aynite` outside `src/renderer/bridge/`
 *   2. No `bridge` imports in `src/renderer/shared/`
 *   3. No `useAppEvent()` or `useAppEventSubscriber()` in individual view files
 *      (only allowed in ViewContext.tsx)
 *   4. Only ONE `bridge.events.onAppEvent` listener — must be in AppContext.tsx
 *   5. Only ONE `window.addEventListener('message', ...)` for aynite events —
 *      must be in ViewContext.tsx
 *   6. No `window.aynite.onAppEvent` outside `src/renderer/bridge/events.ts`
 *
 * Usage:
 *   tsx scripts/audit-bridge-architecture.ts
 *   tsx scripts/audit-bridge-architecture.ts --check # exit code 1 on any violation
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')

const checkMode = process.argv.includes('--check')

const RENDERER_DIR = path.join(ROOT_DIR, 'src/renderer')
const BRIDGE_DIR = path.join(RENDERER_DIR, 'bridge')
const SHARED_DIR = path.join(RENDERER_DIR, 'shared')
const VIEWS_DIR = path.join(RENDERER_DIR, 'views')
const CONTEXTS_DIR = path.join(RENDERER_DIR, 'src/contexts')
const SRC_DIR = path.join(RENDERER_DIR, 'src')

const BRIDGE_EVENTS = path.join(BRIDGE_DIR, 'events.ts')
const APP_CONTEXT = path.join(SRC_DIR, 'AppContext.tsx')
const VIEW_CONTEXT = path.join(VIEWS_DIR, 'ViewContext.tsx')
const ENV_DTS = path.join(RENDERER_DIR, 'src', 'env.d.ts')

interface Violation {
  file: string
  line: number
  snippet: string
  rule: string
}

// ─── Walking (iterative, no generator to avoid OOM with 150+ files) ──────

function collectFiles(dir: string, exts: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  const queue = [dir]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    if (!fs.existsSync(current)) continue

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
          queue.push(fullPath)
        }
      } else if (exts.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath)
      }
    }
  }
  return results
}

function readLines(filePath: string): string[] | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8').split('\n')
  } catch {
    return null
  }
}

// ─── Rule 1: No `window.aynite` outside bridge/ ────────────────────────

function checkRule1(violations: Violation[]) {
  const allowedFiles = new Set([
    path.resolve(ENV_DTS),
  ])

  for (const filePath of collectFiles(RENDERER_DIR)) {
    const abs = path.resolve(filePath)
    if (allowedFiles.has(abs)) continue
    if (abs.startsWith(path.resolve(BRIDGE_DIR))) continue

    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      if (/\bwindow\s*\.\s*aynite\b/.test(lines[i])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: lines[i].trim(),
          rule: 'RULE-1',
        })
      }
    }
  }
}

// ─── Rule 2: No `bridge` imports in `shared/` ──────────────────────────

function checkRule2(violations: Violation[]) {
  for (const filePath of collectFiles(SHARED_DIR)) {
    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/from\s+['"].*\/bridge['"]/.test(line) || /from\s+['"].*\/bridge\/[^'"]+['"]/.test(line)) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: line.trim(),
          rule: 'RULE-2',
        })
      }
    }
  }
}

// ─── Rule 3: No `useAppEvent`/`useAppEventSubscriber` imported from ViewContext ──
//
// These are deprecated re-exports. Views should use `useViewEvent` and
// `useViewEventSubscriber` from `./useViewEvents` instead.
// The check detects imports of the deprecated names from ViewContext.

function checkRule3(violations: Violation[]) {
  const viewContextBase = path.basename(VIEW_CONTEXT)

  for (const filePath of collectFiles(VIEWS_DIR)) {
    if (path.basename(filePath) === viewContextBase) continue

    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for imports of useAppEvent or useAppEventSubscriber from ViewContext
      // Pattern: import { ... useAppEvent ... } from '../ViewContext'
      if (/import\s*\{[^}]*\buseAppEvent\b/.test(line) &&
          /from\s+['"].*\/ViewContext['"]/.test(line)) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: line.trim(),
          rule: 'RULE-3',
        })
      }
      if (/import\s*\{[^}]*\buseAppEventSubscriber\b/.test(line) &&
          /from\s+['"].*\/ViewContext['"]/.test(line)) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: line.trim(),
          rule: 'RULE-3',
        })
      }
    }
  }
}

// ─── Rule 4: Only ONE `bridge.events.onAppEvent` listener (in AppContext) ──

function checkRule4(violations: Violation[]) {
  const appContextBase = path.basename(APP_CONTEXT)

  // Check contexts/
  for (const filePath of collectFiles(CONTEXTS_DIR)) {
    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Check both bridge.events.onAppEvent and window.aynite.onAppEvent
      if (/bridge\s*\.\s*events\s*\.\s*onAppEvent\s*\(/.test(line) ||
          /window\s*\.\s*aynite\s*\.\s*onAppEvent\s*\(/.test(line)) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: line.trim(),
          rule: 'RULE-4',
        })
      }
    }
  }

  // Check src/ (excluding AppContext.tsx)
  for (const filePath of collectFiles(SRC_DIR)) {
    if (path.basename(filePath) === appContextBase) continue

    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      if (/bridge\s*\.\s*events\s*\.\s*onAppEvent\s*\(/.test(lines[i])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: lines[i].trim(),
          rule: 'RULE-4',
        })
      }
    }
  }

  // Check views/ (excluding ViewContext.tsx)
  const viewContextBase = path.basename(VIEW_CONTEXT)
  for (const filePath of collectFiles(VIEWS_DIR)) {
    if (path.basename(filePath) === viewContextBase) continue

    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      if (/bridge\s*\.\s*events\s*\.\s*onAppEvent\s*\(/.test(lines[i])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: lines[i].trim(),
          rule: 'RULE-4',
        })
      }
    }
  }
}

// ─── Rule 5: Only ONE `addEventListener('message', ...)` for aynite events ──
// Allowed files: ViewContext.tsx and useViewEvents.ts (which contains the hooks
// that views use to subscribe to relayed postMessage events)

function checkRule5(violations: Violation[]) {
  const viewContextBase = path.basename(VIEW_CONTEXT)
  const allowedFiles = new Set([
    path.basename(VIEW_CONTEXT),
    'useViewEvents.ts',
  ])

  for (const filePath of collectFiles(VIEWS_DIR)) {
    if (allowedFiles.has(path.basename(filePath))) continue

    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      if (/addEventListener\s*\(\s*['"]message['"]/.test(lines[i])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: lines[i].trim(),
          rule: 'RULE-5',
        })
      }
    }
  }
}

// ─── Rule 6: No raw `window.aynite.onAppEvent` outside bridge/events.ts ──

function checkRule6(violations: Violation[]) {
  const bridgeEventsAbs = path.resolve(BRIDGE_EVENTS)

  for (const filePath of collectFiles(RENDERER_DIR)) {
    if (path.resolve(filePath) === bridgeEventsAbs) continue

    const lines = readLines(filePath)
    if (!lines) continue

    for (let i = 0; i < lines.length; i++) {
      if (/window\s*\.\s*aynite\s*\.\s*onAppEvent\s*\(/.test(lines[i])) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: i + 1,
          snippet: lines[i].trim(),
          rule: 'RULE-6',
        })
      }
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

console.log('🔍 Scanning project for architectural violations (RFC-003)...\n')

const violations: Violation[] = []

checkRule1(violations)
checkRule2(violations)
checkRule3(violations)
checkRule4(violations)
checkRule5(violations)
checkRule6(violations)

// Summary
const byRule: Record<string, number> = {}
const byFile: Record<string, number> = {}
for (const v of violations) {
  byRule[v.rule] = (byRule[v.rule] || 0) + 1
  const key = `${v.rule}:${v.file}`
  byFile[key] = (byFile[key] || 0) + 1
}

// ─── Report ─────────────────────────────────────────────────────────────

console.log('=================================================')
console.log('   Bridge Architecture Compliance Audit')
console.log('=================================================\n')

if (violations.length === 0) {
  console.log('✅ CLEAN: No architectural violations found.\n')
  console.log('  All rules enforced:')
  for (let i = 1; i <= 6; i++) {
    console.log(`  ✓ RULE-${i}`)
  }
  console.log()
  process.exit(0)
}

console.log(`🚨 FOUND ${violations.length} VIOLATION(S):\n`)

const ruleNames: Record<string, string> = {
  'RULE-1': 'window.aynite outside bridge/',
  'RULE-2': 'bridge imports in shared/',
  'RULE-3': 'useAppEvent/useAppEventSubscriber imported from ViewContext',
  'RULE-4': 'Multiple onAppEvent listeners',
  'RULE-5': 'postMessage listeners outside ViewContext/useViewEvents',
  'RULE-6': 'Raw window.aynite.onAppEvent',
}

const ruleFixes: Record<string, string> = {
  'RULE-1': 'Import from bridge instead: import { ... } from "../bridge"',
  'RULE-2': 'Use useApp() instead: import { useApp } from "../../src/AppContext"',
  'RULE-3': 'Import from ./useViewEvents instead: import { useViewEvent } from "../useViewEvents"',
  'RULE-4': 'Move event handling to AppContext.tsx, have it route to this context',
  'RULE-5': 'Use useViewEvent or useViewEventSubscriber from ./useViewEvents instead',
  'RULE-6': 'Use bridge.events.onAppEvent instead of window.aynite.onAppEvent',
}

const fixExamples: Record<string, string> = {
  'RULE-1': `
  ❌ BAD (src/renderer/views/treeview/Treeview.tsx):
    window.aynite.setConfig('activeFile', path)

  ✅ GOOD:
    import { configMutations } from '../../bridge'
    configMutations.set('activeFile', path)
  `,
  'RULE-2': `
  ❌ BAD (src/renderer/shared/featured/FileSwitcher.tsx):
    import { workspace } from '../bridge'

  ✅ GOOD:
    import { useApp } from '../../src/AppContext'
    const { getAllFiles } = useApp()
  `,
  'RULE-3': `
  ❌ BAD (src/renderer/views/workspace-view/WorkspaceView.tsx):
    import { useAppEvent } from '../ViewContext'
    useAppEvent('active-session-changed', (data) => { ... })

  ✅ GOOD:
    import { useViewEvent } from '../useViewEvents'
    useViewEvent('active-session-changed', (data) => { ... })
  `,
  'RULE-4': `
  ❌ BAD (src/renderer/src/contexts/ThemeContext.tsx):
    bridge.events.onAppEvent((event) => {
      if (event.type === 'theme-changed') refreshThemes()
    })

  ✅ GOOD:
    // In AppContext.tsx single router:
    case AppEvents.THEME_CHANGED:
      themeContextRef.current?.refreshThemes()
  `,
  'RULE-5': `
  ❌ BAD (src/renderer/views/some-view/SomeView.tsx):
    window.addEventListener('message', (event) => { ... })

  ✅ GOOD:
    // All message listening goes through ViewContext.tsx
    // Consume state via useViewContext()
  `,
  'RULE-6': `
  ❌ BAD (src/renderer/src/contexts/WorkspaceContext.tsx):
    window.aynite.onAppEvent((event) => { ... })

  ✅ GOOD:
    import { events } from '../bridge'
    events.onAppEvent((event) => { ... })
    // (But even better: move to AppContext and let it route)
  `,
}

for (let ruleNum = 1; ruleNum <= 6; ruleNum++) {
  const ruleId = `RULE-${ruleNum}`
  const count = byRule[ruleId] || 0
  if (count === 0) continue

  console.log(`── ${ruleId}: ${ruleNames[ruleId]} ──`)
  console.log(`   ${count} occurrence(s)\n`)

  // Show fix example
  console.log(`   📖 Fix example:${fixExamples[ruleId]}`)
  console.log()

  // Show first 5 violations
  const shown = violations.filter((v) => v.rule === ruleId).slice(0, 5)
  for (const v of shown) {
    console.log(`  [${v.file}:${v.line}] ${v.snippet}`)
  }
  if (count > 5) {
    console.log(`  ... and ${count - 5} more`)
  }
  console.log()
}

// Summary
console.log('=================================================')
console.log('   Summary')
console.log('=================================================\n')
for (let i = 1; i <= 6; i++) {
  const ruleId = `RULE-${i}`
  const count = byRule[ruleId] || 0
  console.log(`  ${count === 0 ? '✓' : '✗'} ${ruleId}: ${count} violations — ${ruleNames[ruleId]}`)
}
console.log(`\n  TOTAL: ${violations.length} violation(s)\n`)

if (checkMode) {
  process.exit(violations.length > 0 ? 1 : 0)
}
