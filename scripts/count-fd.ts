import { execSync } from 'node:child_process'

interface ProcessInfo {
  pid: string
  name: string
  fdCount: number
  type: string
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
  } catch {
    return ''
  }
}

// Find all Aynite-related processes
// Handles both dev mode (Electron Helper) and built app (Aynite)
// Use proper alternation (not a character class) to avoid matching every process on the system
const psOutput = run(
  `ps -ef | grep -E 'Aynite|Electron' | grep -v grep | grep -v count-fd`,
)

const lines = psOutput.split('\n').filter(Boolean)
const processes: ProcessInfo[] = []

for (const line of lines) {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 8) continue

  const pid = parts[1]
  const fullCommand = parts.slice(7).join(' ')

  // Skip non-Aynite processes (e.g. other apps using Electron like VS Code, Obsidian)
  if (
    !fullCommand.includes('Aynite') &&
    !fullCommand.includes('/Users/wentao/repos/aynite/')
  ) {
    continue
  }

  // Determine process type
  let type = 'unknown'
  if (fullCommand.includes('--type=gpu-process')) type = 'gpu'
  else if (fullCommand.includes('--type=utility')) {
    if (fullCommand.includes('network.mojom.NetworkService')) type = 'network'
    else type = 'utility'
  } else if (fullCommand.includes('--type=renderer')) type = 'renderer'
  else if (fullCommand.includes('Electron') || fullCommand.includes('Aynite')) {
    const isMain = !fullCommand.includes('Helper')
    type = isMain ? 'main' : 'helper'
  }

  // Extract short name
  const match = fullCommand.match(
    /\/(?:Aynite(?: Helper)?(?: \(Renderer\))?|Electron(?: Helper)?(?: \(Renderer\))?)\.app/,
  )
  const name = match
    ? match[0].split('/').pop()?.replace('.app', '') || `PID ${pid}`
    : `PID ${pid}`

  // Count file descriptors using lsof (capture stderr to avoid permission errors)
  const lsofOutput = run(`lsof -p ${pid} 2>/dev/null | wc -l`)
  const fdCount = lsofOutput ? Number.parseInt(lsofOutput.trim(), 10) : 0

  processes.push({ pid, name, fdCount, type })
}

// Sort: main first, then by FD count descending
const typeOrder: Record<string, number> = {
  main: 0,
  gpu: 1,
  network: 2,
  renderer: 3,
  helper: 4,
  utility: 5,
  unknown: 6,
}
processes.sort(
  (a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99),
)

// Report
console.log()
console.log('  ╔══════════════════════════════════════════════════════╗')
console.log('  ║        Aynite File Descriptor Usage                 ║')
console.log('  ╚══════════════════════════════════════════════════════╝')
console.log()

if (processes.length === 0) {
  console.log('  No Aynite processes found.')
  console.log('  Make sure the app is running (dev: npm run dev)')
  process.exit(0)
}

const pidWidth = Math.max(...processes.map((p) => p.pid.length), 3)
const nameWidth = Math.max(...processes.map((p) => p.name.length), 15)
const typeWidth = Math.max(...processes.map((p) => p.type.length), 10)
const totalWidth = pidWidth + nameWidth + typeWidth + 20

console.log(
  `  ${'PID'.padStart(pidWidth)}  ${'Process'.padEnd(nameWidth)}  ${'Type'.padEnd(typeWidth)}  ${'Open FDs'.padStart(9)}`,
)
console.log(`  ${'─'.repeat(totalWidth)}`)

let totalFds = 0
for (const p of processes) {
  totalFds += p.fdCount
  const fdStr =
    p.fdCount > 0 ? p.fdCount.toLocaleString() : 'N/A'
  console.log(
    `  ${p.pid.padStart(pidWidth)}  ${p.name.padEnd(nameWidth)}  ${p.type.padEnd(typeWidth)}  ${fdStr.padStart(9)}`,
  )
}

console.log(`  ${'─'.repeat(totalWidth)}`)
console.log(
  `  ${''.padStart(pidWidth)}  ${'TOTAL'.padEnd(nameWidth)}  ${''.padEnd(typeWidth)}  ${totalFds.toLocaleString().padStart(9)}`,
)
console.log()
console.log(`  ${processes.length} process(es) found`)
console.log()

// Warn if FD count is high
if (totalFds > 1000) {
  console.log('  ⚠️  High FD usage detected (>1,000 total).')
  console.log('     Run `lsof -p <PID>` to investigate which files are open.')
}
console.log()
