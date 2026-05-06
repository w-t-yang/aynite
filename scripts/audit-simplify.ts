import { spawnSync } from 'node:child_process'

const CHECKS: { label: string; cmd: string }[] = [
  { label: 'Complexity', cmd: 'tsx scripts/audit-complexity.ts' },
  { label: 'Exports', cmd: 'tsx scripts/audit-exports.ts' },
  { label: 'Duplication', cmd: 'jscpd --config .jscpd.json' },
  { label: 'Circular', cmd: 'madge --warning --circular --extensions ts,tsx src/' },
  { label: 'Patterns', cmd: 'tsx scripts/audit-patterns.ts' },
]

function run(label: string, cmd: string): { status: number | null; duration: number } {
  const start = Date.now()
  console.log(`\n  ── ${label} ${'─'.repeat(Math.max(2, 59 - label.length))}\n`)
  const result = spawnSync(cmd, { stdio: 'inherit', shell: true, timeout: 120_000 })
  return { status: result.status, duration: Date.now() - start }
}

const results = CHECKS.map((c) => ({ ...c, ...run(c.label, c.cmd) }))

console.log(`\n\n  ╔══════════════════════════════════════════════════════╗`)
console.log(`  ║              Simplify — Summary Report              ║`)
console.log(`  ╚══════════════════════════════════════════════════════╝`)
console.log()

for (const r of results) {
  const icon = r.status === 0 ? ' ✓' : ' ✗'
  const label = r.label.padEnd(12)
  const time = `${(r.duration / 1000).toFixed(1)}s`.padStart(7)
  const status = r.status === 0 ? 'ok' : `exit ${r.status}`
  console.log(`   ${icon}  ${label} ${time}  ${status}`)
}

const passed = results.filter((r) => r.status === 0).length
console.log(`\n   ${passed}/${results.length} checks passed\n`)
