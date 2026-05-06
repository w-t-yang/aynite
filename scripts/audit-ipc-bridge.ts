#!/usr/bin/env tsx
/**
 * IPC Bridge Contract Audit
 *
 * Cross-references channels invoked in the preload bridge against handlers
 * registered in all main-process ipc.ts files. Reports:
 *   1. Channels invoked by preload but NOT handled → runtime crashes
 *   2. Channels with handlers but NOT invoked → potential dead code
 *   3. Listener channels by type (invoke/handle vs on/send)
 *
 * Usage:
 *   tsx scripts/audit-ipc-bridge.ts
 *   tsx scripts/audit-ipc-bridge.ts --json   # machine-readable output
 *   tsx scripts/audit-ipc-bridge.ts --check  # exit code 1 on any mismatch
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const jsonOutput = process.argv.includes('--json')
const checkMode = process.argv.includes('--check')

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChannelRef {
  channel: string // resolved channel string
  expression: string // source expression (e.g. "ConfigChannels.GET")
  file: string // relative file path
  line: number
  kind: 'invoke' | 'handle' | 'on-send' | 'on-listen'
}

interface AuditResult {
  preloadInvocations: ChannelRef[]
  preloadListeners: ChannelRef[]
  preloadSends: ChannelRef[]
  mainHandlers: ChannelRef[]
  mainListeners: ChannelRef[]
  notHandled: ChannelRef[]
  notInvoked: ChannelRef[]
  listenerMismatches: string[]
}

// ─── Step 1: Parse channel definitions from ipc-channels.ts ─────────────────

function parseChannelDefinitions(): Map<string, string> {
  const filePath = path.join(ROOT, 'src/lib/constants/ipc-channels.ts')
  const content = fs.readFileSync(filePath, 'utf-8')
  const defs = new Map<string, string>()

  // Match:  KEY: 'channel-string',
  // Inside const objects like "export const ConfigChannels = { ... }"
  const channelRegex = /(\w+)\s*:\s*'([^']+)'/g
  let match: RegExpExecArray | null
  while ((match = channelRegex.exec(content)) !== null) {
    defs.set(match[1], match[2])
  }

  // Also match the aiChatDeltaChannel function
  const funcRegex = /export\s+function\s+(\w+)/
  const funcMatch = funcRegex.exec(content)
  if (funcMatch) {
    defs.set(funcMatch[1], funcMatch[1]) // mark as known function
  }

  return defs
}

// ─── Step 2: Parse preload bridge ──────────────────────────────────────────

function parsePreload(): {
  invocations: ChannelRef[]
  listeners: ChannelRef[]
  sends: ChannelRef[]
} {
  const filePath = path.join(ROOT, 'src/preload/index.ts')
  const content = fs.readFileSync(filePath, 'utf-8')
  const _lines = content.split('\n')

  const invocations: ChannelRef[] = []
  const listeners: ChannelRef[] = []
  const sends: ChannelRef[] = []
  const channelDefs = parseChannelDefinitions()

  const invokePattern = /ipcRenderer\.(invoke|on|send)\(([^)]+)\)/g
  let match: RegExpExecArray | null

  while ((match = invokePattern.exec(content)) !== null) {
    const method = match[1]
    const args = match[2]
    const lineNum = content.substring(0, match.index).split('\n').length

    // The first argument is the channel expression
    const channelExpr = args.split(',')[0].trim()

    // Try to resolve the channel expression to an actual string
    const resolvedChannel = resolveChannel(channelExpr, channelDefs)

    if (resolvedChannel) {
      const ref: ChannelRef = {
        channel: resolvedChannel,
        expression: channelExpr,
        file: 'src/preload/index.ts',
        line: lineNum,
        kind:
          method === 'invoke'
            ? 'invoke'
            : method === 'on'
              ? 'on-listen'
              : 'on-send',
      }

      if (method === 'invoke') {
        invocations.push(ref)
      } else if (method === 'on') {
        listeners.push(ref)
      } else {
        sends.push(ref)
      }
    } else {
      // Dynamic channel (e.g. aiChatDeltaChannel(requestId)) — report separately
      const ref: ChannelRef = {
        channel: channelExpr,
        expression: channelExpr,
        file: 'src/preload/index.ts',
        line: lineNum,
        kind: method === 'invoke' ? 'invoke' : 'on-listen',
      }
      listeners.push(ref)
    }
  }

  return { invocations, listeners, sends }
}

// ─── Step 3: Parse main ipc.ts files ───────────────────────────────────────

function parseMainIpcFiles(): {
  handlers: ChannelRef[]
  listeners: ChannelRef[]
} {
  const mainDir = path.join(ROOT, 'src/main')
  const handlers: ChannelRef[] = []
  const listeners: ChannelRef[] = []
  const channelDefs = parseChannelDefinitions()

  const ipcFiles = findIpcFiles(mainDir)

  for (const file of ipcFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    const relativeFile = path.relative(ROOT, file)

    // Match ipcMain.handle(Channel.KEY, ...) and ipcMain.on(Channel.KEY, ...)
    const patterns = [
      { regex: /ipcMain\.(handle)\(([^,]+),/g, kind: 'handle' as const },
      { regex: /ipcMain\.(on)\(([^,]+),/g, kind: 'on-listen' as const },
    ]

    for (const { regex, kind } of patterns) {
      let match: RegExpExecArray | null
      while ((match = regex.exec(content)) !== null) {
        const channelExpr = match[2].trim()
        const lineNum = content.substring(0, match.index).split('\n').length
        const resolvedChannel =
          resolveChannel(channelExpr, channelDefs) || channelExpr

        const ref: ChannelRef = {
          channel: resolvedChannel,
          expression: channelExpr,
          file: relativeFile,
          line: lineNum,
          kind,
        }

        if (kind === 'handle') {
          handlers.push(ref)
        } else {
          listeners.push(ref)
        }
      }
    }
  }

  return { handlers, listeners }
}

function findIpcFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...findIpcFiles(path.join(dir, entry.name)))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      const filePath = path.join(dir, entry.name)
      const content = fs.readFileSync(filePath, 'utf-8')
      if (/ipcMain\.(handle|on)\(/.test(content)) {
        results.push(filePath)
      }
    }
  }
  return results
}

// ─── Channel resolution ─────────────────────────────────────────────────────

function resolveChannel(
  expr: string,
  channelDefs: Map<string, string>,
): string | null {
  // Handle: ChannelName.KEY (e.g. ConfigChannels.GET)
  const memberMatch = expr.match(/^(\w+)\.(\w+)$/)
  if (memberMatch) {
    const key = memberMatch[2]
    const resolved = channelDefs.get(key)
    if (resolved) return resolved
  }

  // Handle: functionCall(args) — dynamic channels like aiChatDeltaChannel(id)
  const funcMatch = expr.match(/^(\w+)\(/)
  if (funcMatch && channelDefs.has(funcMatch[1])) {
    return `${funcMatch[1]}(...)` // dynamic channel
  }

  // Handle: literal string (unlikely but possible)
  if (expr.startsWith("'") || expr.startsWith('"')) {
    return expr.replace(/['"]/g, '')
  }

  return null
}

// ─── Main audit logic ──────────────────────────────────────────────────────

function audit(): AuditResult {
  const preload = parsePreload()
  const main = parseMainIpcFiles()

  const preloadInvocations = preload.invocations
  const preloadListeners = preload.listeners
  const preloadSends = preload.sends
  const mainHandlers = main.handlers
  const mainListeners = main.listeners

  // Channels invoked by preload but not handled by main
  const notHandled = preloadInvocations.filter(
    (inv) => !mainHandlers.some((h) => h.channel === inv.channel),
  )

  // Channels handled by main but never invoked from preload
  const notInvoked = mainHandlers.filter(
    (h) => !preloadInvocations.some((inv) => inv.channel === h.channel),
  )

  // Listener mismatches: channels main listens for via ipcMain.on, but preload
  // never sends via ipcRenderer.send
  const listenerMismatches: string[] = []
  for (const ml of mainListeners) {
    if (!preloadSends.some((ps) => ps.channel === ml.channel)) {
      listenerMismatches.push(
        `Main listens for "${ml.channel}" (${ml.expression} in ${ml.file}:${ml.line}) but preload never sends it`,
      )
    }
  }
  for (const ps of preloadSends) {
    if (!mainListeners.some((ml) => ml.channel === ps.channel)) {
      listenerMismatches.push(
        `Preload sends "${ps.channel}" (${ps.expression} in ${ps.file}:${ps.line}) but main never listens for it`,
      )
    }
  }

  return {
    preloadInvocations,
    preloadListeners,
    preloadSends,
    mainHandlers,
    mainListeners,
    notHandled,
    notInvoked,
    listenerMismatches,
  }
}

// ─── Reporting ──────────────────────────────────────────────────────────────

function printReport(result: AuditResult): void {
  const {
    notHandled,
    notInvoked,
    listenerMismatches,
    preloadInvocations,
    preloadListeners,
    preloadSends,
    mainHandlers,
    mainListeners,
  } = result

  const hasErrors = notHandled.length > 0 || listenerMismatches.length > 0

  console.log('\n=================================================')
  console.log('   IPC Bridge Contract Audit')
  console.log('=================================================\n')

  console.log(
    `Preload bridge: ${preloadInvocations.length} invocations, ${preloadListeners.length} listeners, ${preloadSends.length} sends`,
  )
  console.log(
    `Main handlers:  ${mainHandlers.length} handles, ${mainListeners.length} listeners\n`,
  )

  // ── Excluded: unhandled dynamic channels ──
  const dynamicChannels = ['aiChatDeltaChannel(...)']
  const realNotHandled = notHandled.filter(
    (n) => !dynamicChannels.includes(n.channel),
  )

  if (realNotHandled.length > 0) {
    console.log(
      `🚨 CRITICAL: ${realNotHandled.length} channel(s) invoked by preload have NO handler\n`,
    )
    for (const ref of realNotHandled) {
      console.log(`   [${ref.file}:${ref.line}] ${ref.expression}`)
      console.log(
        `   └─ Channel "${ref.channel}" is never handled by any ipcMain.handle()`,
      )
      console.log()
    }
  }

  // ── Potential dead code ──
  if (notInvoked.length > 0) {
    console.log(
      `⚠️  WARNING: ${notInvoked.length} channel(s) have handlers but are never invoked from preload\n`,
    )
    for (const ref of notInvoked) {
      console.log(`   [${ref.file}:${ref.line}] ${ref.expression}`)
      console.log(
        `   └─ Handler for "${ref.channel}" exists but no preload code calls it`,
      )
      console.log()
    }
  }

  // ── Listener mismatches ──
  if (listenerMismatches.length > 0) {
    console.log(
      `🚨 CRITICAL: ${listenerMismatches.length} listener mismatch(es)\n`,
    )
    for (const msg of listenerMismatches) {
      console.log(`   └─ ${msg}`)
      console.log()
    }
  }

  // ── Summary ──
  console.log('=================================================')
  console.log('   Summary')
  console.log('=================================================\n')
  console.log(`  Preload → Main (invoke/handle):`)
  console.log(`    ${preloadInvocations.length} total invocations`)
  console.log(`    ${mainHandlers.length} total handlers`)
  console.log(`    ${realNotHandled.length} unhandled invocations`)
  console.log(`    ${notInvoked.length} unused handlers`)
  console.log()
  console.log(`  Preload ↔ Main (send/on listener):`)
  console.log(`    ${preloadSends.length} preload sends`)
  console.log(`    ${mainListeners.length} main listeners`)
  console.log(`    ${listenerMismatches.length} mismatches`)
  console.log()

  if (hasErrors) {
    console.log(
      '❌ CONTRACT BREACHES DETECTED — review and fix the issues above.\n',
    )
  } else {
    console.log(
      '✅ BRIDGE CONTRACT INTACT — every preload IPC call has a matching handler.\n',
    )
  }

  if (checkMode) {
    process.exit(hasErrors ? 1 : 0)
  }
}

// ─── JSON output ────────────────────────────────────────────────────────────

function printJson(result: AuditResult): void {
  const output = {
    preload: {
      invocations: result.preloadInvocations,
      listeners: result.preloadListeners,
      sends: result.preloadSends,
    },
    main: {
      handlers: result.mainHandlers,
      listeners: result.mainListeners,
    },
    mismatches: {
      notHandled: result.notHandled,
      notInvoked: result.notInvoked,
      listenerMismatches: result.listenerMismatches,
    },
    summary: {
      totalInvocations: result.preloadInvocations.length,
      totalHandlers: result.mainHandlers.length,
      unhandled: result.notHandled.length,
      unusedHandlers: result.notInvoked.length,
      listenerMismatches: result.listenerMismatches.length,
      contractIntact:
        result.notHandled.length === 0 &&
        result.listenerMismatches.length === 0,
    },
  }
  console.log(JSON.stringify(output, null, 2))
  if (checkMode) {
    process.exit(output.summary.contractIntact ? 0 : 1)
  }
}

// ─── Entry ──────────────────────────────────────────────────────────────────

const result = audit()
if (jsonOutput) {
  printJson(result)
} else {
  printReport(result)
}
