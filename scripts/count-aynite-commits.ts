import { execSync } from 'node:child_process'

const SINCE_COMMIT = 'ebe284c07baa0ca79c3c368b0d03ede6056d72cc'

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() }).trim()
}

// Count commits from SINCE_COMMIT (inclusive) to HEAD
const countStr = run(`git rev-list --count ${SINCE_COMMIT}^..HEAD`)
const commitCount = Number(countStr)

// Get lines added/deleted since SINCE_COMMIT (exclusive — diff against the commit)
const shortstat = run(`git diff --shortstat ${SINCE_COMMIT}..HEAD`)
const statMatch = shortstat.match(
  /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/,
)
const filesChanged = Number(statMatch?.[1] ?? 0)
const linesAdded = Number(statMatch?.[2] ?? 0)
const linesDeleted = Number(statMatch?.[3] ?? 0)

console.log()
console.log('  ╔══════════════════════════════════════════════╗')
console.log('  ║       Aynite Commit Summary Since Start      ║')
console.log('  ╚══════════════════════════════════════════════╝')
console.log()
console.log(`   Since commit:  ${SINCE_COMMIT.slice(0, 12)}`)
console.log(`   ─────────────────────────────────────────`)
console.log(`   Commits:       ${commitCount}`)
console.log(`   Files changed: ${filesChanged}`)
console.log(`   Lines added:   ${linesAdded}`)
console.log(`   Lines deleted: ${linesDeleted}`)
console.log(`   Net change:    ${linesAdded - linesDeleted >= 0 ? '+' : ''}${linesAdded - linesDeleted}`)
console.log()
