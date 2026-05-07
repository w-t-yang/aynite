import { spawnSync } from 'node:child_process'

type Metrics = Record<string, number | string>

interface CheckDef {
  label: string
  cmd: string
  parse: (output: string, status: number | null) => Metrics
}

const CHECKS: CheckDef[] = [
  {
    label: 'UI Architecture',
    cmd: 'tsx scripts/audit-ui.ts',
    parse: (output, status) => {
      if (status === 0) return { violations: 0 }
      const m = output.match(/🚨 TYPING.*\((\d+)/)
      return { violations: Number(m?.[1] ?? 1) }
    },
  },
  {
    label: 'Main Architecture',
    cmd: 'tsx scripts/audit-main.ts',
    parse: (_output, status) => {
      if (status === 0) return { violations: 0 }
      return { violations: 1 }
    },
  },
  {
    label: 'Bridge',
    cmd: 'tsx scripts/audit-ipc-bridge.ts',
    parse: (_output, status) => {
      if (status === 0) return { violations: 0 }
      return { violations: 1 }
    },
  },
  {
    label: 'Preload Isolation',
    cmd: 'tsx scripts/base-audit-preload.ts',
    parse: (_output, status) => {
      if (status === 0) return { violations: 0 }
      return { violations: 1 }
    },
  },
  {
    label: 'Constants Isolation',
    cmd: 'tsx scripts/base-audit-constants.ts',
    parse: (output) => {
      const m = output.match(/TOTAL VIOLATIONS: (\d+)/)
      return { violations: Number(m?.[1] ?? 0) }
    },
  },
  {
    label: 'Types Isolation',
    cmd: 'tsx scripts/base-audit-types.ts',
    parse: (output) => {
      const m = output.match(/TOTAL VIOLATIONS: (\d+)/)
      return { violations: Number(m?.[1] ?? 0) }
    },
  },
  {
    label: 'Window Architecture',
    cmd: 'tsx scripts/base-audit-window.ts',
    parse: (_output, status) => {
      if (status === 0) return { violations: 0 }
      return { violations: 1 }
    },
  },
  {
    label: 'Path Isolation',
    cmd: 'tsx scripts/base-audit-path.ts',
    parse: (output) => {
      const m = output.match(/TOTAL VIOLATIONS: (\d+)/)
      return { violations: Number(m?.[1] ?? 0) }
    },
  },
  {
    label: 'Complexity',
    cmd: 'tsx scripts/audit-complexity.ts',
    parse: (output) => {
      const m = output.match(
        /Total:\s*(\d+)\s+functions flagged\s*\((\d+)\s+high,\s*(\d+)\s+medium\)/,
      )
      if (m)
        return {
          flagged: Number(m[1]),
          high: Number(m[2]),
          medium: Number(m[3]),
        }
      return { flagged: 0, high: 0, medium: 0 }
    },
  },
  {
    label: 'Exports',
    cmd: 'tsx scripts/audit-exports.ts',
    parse: (output) => {
      const m = output.match(
        /Total:\s*(\d+)\s+dead,\s*(\d+)\s+internal-only,\s*(\d+)\s+unnecessary barrels/,
      )
      if (m)
        return {
          dead: Number(m[1]),
          internal: Number(m[2]),
          barrels: Number(m[3]),
        }
      return { dead: 0, internal: 0, barrels: 0 }
    },
  },
  {
    label: 'Duplication',
    cmd: 'jscpd --config .jscpd.json',
    parse: (output) => {
      // "Found 47 clones." at end of jscpd output
      const m = output.match(/Found\s+(\d+)\s+clone/)
      return { clones: Number(m?.[1] ?? 0) }
    },
  },
  {
    label: 'Circular',
    cmd: 'madge --warning --circular --extensions ts,tsx src/',
    parse: (output) => {
      const clean = output.includes('No circular dependency found')
      if (clean) return { circular: 0 }
      // Count lines mentioning circular deps
      const lines = output
        .split('\n')
        .filter((l) => l.includes('->') || l.includes('→')).length
      return { circular: lines || 1 }
    },
  },
  {
    label: 'Patterns',
    cmd: 'tsx scripts/audit-patterns.ts',
    parse: (output) => {
      const m = output.match(
        /Total:\s*(\d+)\s+patterns\s*\((\d+)\s+high,\s*(\d+)\s+medium,\s*(\d+)\s+info\)/,
      )
      if (m)
        return {
          patterns: Number(m[1]),
          high: Number(m[2]),
          medium: Number(m[3]),
          info: Number(m[4]),
        }
      return { patterns: 0, high: 0, medium: 0, info: 0 }
    },
  },
  {
    label: 'AST-Grep',
    cmd: 'ast-grep scan',
    parse: (output, status) => {
      if (status === 0) return { violations: 0 }
      const m = output.match(/Found\s+(\d+)\s+matches/)
      return { violations: Number(m?.[1] ?? 1) }
    },
  },
  {
    label: 'Dead Code',
    cmd: 'knip',
    parse: (output, status) => {
      if (status === 0) return { issues: 0 }
      const m = output.match(/(\d+)\s+files?/)
      return { issues: Number(m?.[1] ?? 1) }
    },
  },
  {
    label: 'Communication',
    cmd: 'tsx scripts/audit-communication.ts',
    parse: (output) => {
      const m = output.match(/Total:\s*(\d+)\s+issue/)
      return { issues: Number(m?.[1] ?? 0) }
    },
  },
]

function run(
  label: string,
  cmd: string,
): { status: number | null; duration: number; output: string } {
  const start = Date.now()
  console.log(`\n  ── ${label} ${'─'.repeat(Math.max(2, 59 - label.length))}\n`)
  const result = spawnSync(cmd, {
    stdio: 'pipe',
    shell: true,
    timeout: 120_000,
  })
  const stdout = result.stdout?.toString() ?? ''
  const stderr = result.stderr?.toString() ?? ''
  const output = stdout + stderr
  // Print captured output line-buffered to preserve subprocess display
  process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)
  return { status: result.status, duration: Date.now() - start, output }
}

function formatMetrics(label: string, m: Metrics): string {
  switch (label) {
    case 'UI Architecture':
    case 'Main Architecture':
    case 'Bridge':
    case 'Preload Isolation':
    case 'Constants Isolation':
    case 'Types Isolation':
    case 'Window Architecture':
    case 'Path Isolation':
      return m.violations === 0 ? 'clean' : `${m.violations} violations`
    case 'Complexity':
      return `${m.flagged} flagged (${m.high} high, ${m.medium} medium)`
    case 'Exports':
      return `${m.dead} dead, ${m.internal} internal-only, ${m.barrels} barrels`
    case 'Duplication':
      return `${m.clones} clones`
    case 'Circular':
      return m.circular === 0
        ? 'no circular deps'
        : `${m.circular} circular deps`
    case 'Patterns':
      return `${m.patterns} patterns (${m.high} high, ${m.medium} medium, ${m.info} info)`
    case 'AST-Grep':
      return m.violations === 0 ? 'clean' : `${m.violations} violations`
    case 'Dead Code':
      return m.issues === 0 ? 'clean' : `${m.issues} issues`
    case 'Communication':
      return m.issues === 0 ? 'clean' : `${m.issues} violations`
    default:
      return ''
  }
}

const results = CHECKS.map((c) => {
  const { status, duration, output } = run(c.label, c.cmd)
  return { label: c.label, status, duration, metrics: c.parse(output, status) }
})

console.log(`\n\n  ╔══════════════════════════════════════════════════════╗`)
console.log(`  ║                 Audit — Summary Report              ║`)
console.log(`  ╚══════════════════════════════════════════════════════╝`)
console.log()

for (const r of results) {
  const icon = r.status === 0 ? ' ✓' : ' ✗'
  const label = r.label.padEnd(18)
  const time = `${(r.duration / 1000).toFixed(1)}s`.padStart(7)
  const summary = formatMetrics(r.label, r.metrics)
  console.log(`   ${icon}  ${label} ${time}  ${summary}`)
}

const passed = results.filter((r) => r.status === 0).length
const failed = results.filter((r) => r.status !== 0)
console.log(`\n   ${passed}/${results.length} checks passed`)
if (failed.length > 0) {
  console.log(`   Failed: ${failed.map((r) => r.label).join(', ')}`)
}
console.log()
