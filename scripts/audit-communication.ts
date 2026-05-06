import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT_DIR, 'src')

interface AuditIssue {
  type: string
  file: string
  line: number
  snippet: string
  message: string
}

interface ViolationRule {
  key: string
  name: string
  description: string
  regex?: RegExp
}

const VIOLATIONS: Record<string, ViolationRule> = {
  DIRECT_WEB_CONTENTS_SEND: {
    key: 'push-raw',
    name: 'Direct webContents.send()',
    description:
      'Push notifications must use broadcastAppEvent() instead of direct webContents.send(). Exception: src/main/broadcast.ts and src/main/config/index.ts (legacy).',
    regex: /webContents\.send\(/,
  },
  RENDERER_IPC_RENDERER_ON: {
    key: 'push-listen-raw',
    name: 'Raw ipcRenderer.on() in renderer',
    description:
      'Renderer code must not use raw ipcRenderer.on(). Listeners must go through the preload bridge (window.aynite.onAppEvent).',
    regex: /ipcRenderer\.on\(/,
  },
  DIRECT_IPC_RENDERER: {
    key: 'ipc-raw',
    name: 'Raw ipcRenderer in preload-style code outside preload',
    description:
      'ipcRenderer should only be accessed in src/preload/index.ts. Shared/renderer code must use window.aynite or window.api.',
    regex: /ipcRenderer\.(send|invoke|on)\(/,
  },
  LEGACY_ON_THEME_LISTENER: {
    key: 'legacy-theme',
    name: 'Legacy onThemeChanged listener',
    description:
      'Use onAppEvent("theme-changed", handler) instead of onThemeChanged(). The onThemeChanged API is deprecated.',
    regex: /\.onThemeChanged\(/,
  },
  IFRAME_POST_MESSAGE_DIRECT: {
    key: 'postmessage-direct',
    name: 'Direct postMessage to iframes outside relay',
    description:
      'postMessage to iframes should go through AppEventRelay, not be done directly. Exception: src/renderer/shared/lib/appEvents.ts',
    regex: /contentWindow\?\.postMessage\(/,
    // Note: this is informational — the main renderer contexts may need to send
    // other postMessages. We only flag it if it's sending aynite-* events.
  },
  CHANNEL_OUTSIDE_CONSTANTS: {
    key: 'channel-raw',
    name: 'Raw IPC channel string outside ipc-channels.ts',
    description:
      'IPC channel strings must be defined in src/lib/constants/ipc-channels.ts and imported by reference, not inlined.',
    regex: /['"]aynite:[a-z-]+['"]/,
  },
}

function findIssues(filePath: string, root: string): AuditIssue[] {
  if (!fs.existsSync(filePath)) return []
  const stat = fs.statSync(filePath)
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(filePath)
    const results: AuditIssue[] = []
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') continue
      results.push(...findIssues(path.join(filePath, entry), root))
    }
    return results
  }

  if (
    !/\.(ts|tsx)$/.test(filePath) ||
    filePath.includes('node_modules') ||
    filePath.includes('.git')
  ) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const issues: AuditIssue[] = []
  const relPath = path.relative(root, filePath)

  // Skip files that are exempt
  const isExempt = (patterns: string[]) =>
    patterns.some((p) => relPath.startsWith(p) || relPath.endsWith(p))

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const snippet = line.trim().slice(0, 80)

    // Check for raw webContents.send() outside allowed files
    if (
      !isExempt([
        'src/main/broadcast.ts',
        'src/main/config/index.ts', // legacy — will migrate
      ]) &&
      VIOLATIONS.DIRECT_WEB_CONTENTS_SEND.regex?.test(line)
    ) {
      // Only flag it if we're in main process code
      if (relPath.startsWith('src/main/')) {
        issues.push({
          type: VIOLATIONS.DIRECT_WEB_CONTENTS_SEND.key,
          file: relPath,
          line: lineNum,
          snippet,
          message: VIOLATIONS.DIRECT_WEB_CONTENTS_SEND.description,
        })
      }
    }

    // Check for ipcRenderer.on() in renderer code
    if (
      relPath.startsWith('src/renderer/') &&
      !isExempt(['src/preload/index.ts']) &&
      VIOLATIONS.RENDERER_IPC_RENDERER_ON.regex?.test(line)
    ) {
      issues.push({
        type: VIOLATIONS.RENDERER_IPC_RENDERER_ON.key,
        file: relPath,
        line: lineNum,
        snippet,
        message: VIOLATIONS.RENDERER_IPC_RENDERER_ON.description,
      })
    }

    // Check for raw ipcRenderer outside preload
    if (
      !isExempt(['src/preload/index.ts', 'src/lib/', 'src/main/']) &&
      VIOLATIONS.DIRECT_IPC_RENDERER.regex?.test(line)
    ) {
      issues.push({
        type: VIOLATIONS.DIRECT_IPC_RENDERER.key,
        file: relPath,
        line: lineNum,
        snippet,
        message: VIOLATIONS.DIRECT_IPC_RENDERER.description,
      })
    }

    // Check for legacy onThemeChanged in view code
    if (
      relPath.startsWith('src/renderer/') &&
      !isExempt(['src/renderer/src/env.d.ts', 'src/preload/index.ts']) &&
      VIOLATIONS.LEGACY_ON_THEME_LISTENER.regex?.test(line)
    ) {
      issues.push({
        type: VIOLATIONS.LEGACY_ON_THEME_LISTENER.key,
        file: relPath,
        line: lineNum,
        snippet,
        message: VIOLATIONS.LEGACY_ON_THEME_LISTENER.description,
      })
    }

    // Check for raw channel strings outside ipc-channels.ts
    if (
      !isExempt([
        'src/lib/constants/ipc-channels.ts',
        'src/renderer/shared/lib/appEvents.ts',
        'src/preload/index.ts',
        'src/main/broadcast.ts',
      ]) &&
      VIOLATIONS.CHANNEL_OUTSIDE_CONSTANTS.regex?.test(line)
    ) {
      issues.push({
        type: VIOLATIONS.CHANNEL_OUTSIDE_CONSTANTS.key,
        file: relPath,
        line: lineNum,
        snippet,
        message: VIOLATIONS.CHANNEL_OUTSIDE_CONSTANTS.description,
      })
    }
  }

  return issues
}

// ─── Main ────────────────────────────────────────────────────────────────────

const allIssues: AuditIssue[] = []
const dirs = [
  path.join(SRC_DIR, 'main'),
  path.join(SRC_DIR, 'renderer'),
  path.join(SRC_DIR, 'lib'),
  path.join(SRC_DIR, 'preload'),
]

for (const dir of dirs) {
  allIssues.push(...findIssues(dir, ROOT_DIR))
}

// Group by type
const byType = new Map<string, AuditIssue[]>()
for (const issue of allIssues) {
  if (!byType.has(issue.type)) byType.set(issue.type, [])
  byType.get(issue.type)?.push(issue)
}

// ─── Report ───────────────────────────────────────────────────────────────────

let total = 0
let ruleCount = 0

console.log(`\n  ── Communication Audit ─────────────────────────────────\n`)

for (const [type, issues] of byType) {
  const rule = Object.values(VIOLATIONS).find((r) => r.key === type)
  const title = rule?.name ?? type
  console.log(`  ${title}`)
  console.log(`  ${'─'.repeat(title.length)}`)
  console.log(`  ${rule?.description ?? ''}\n`)

  for (const issue of issues) {
    console.log(`    ${issue.file}:${issue.line}`)
    console.log(`    → ${issue.snippet}`)
    console.log()
  }

  total += issues.length
  ruleCount++
}

console.log(`  ${'─'.repeat(50)}`)
console.log(`  Total: ${total} issue(s) across ${ruleCount} rule(s)`)

if (total > 0) {
  console.log(`\n  Summary of rules violated:`)
  for (const [type, issues] of byType) {
    const rule = Object.values(VIOLATIONS).find((r) => r.key === type)
    console.log(`    ✗  ${rule?.name ?? type}  (${issues.length})`)
  }
}

console.log()
