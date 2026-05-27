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

// ── Contribution ratio (hardcoded pre-Aynite values) ──
// Before the first Aynite-made commit (ebe284c), the codebase was built by:
//   71 commits — Claude Code + DeepSeek-V4-Flash  (Co-Authored-By: Claude Opus 4.7)
//  224 commits — Antigravity + Gemini               (no co-author)
const PRE_AYNITE_CLAUDE = 71
const PRE_AYNITE_ANTIGRAVITY = 224
const AYNITE_COMMITS = commitCount // everything since ebe284c is Aynite + deepseek-v4-flash
const TOTAL = PRE_AYNITE_CLAUDE + PRE_AYNITE_ANTIGRAVITY + AYNITE_COMMITS
const ayniteRatio = ((AYNITE_COMMITS / TOTAL) * 100).toFixed(1)
const claudeRatio = ((PRE_AYNITE_CLAUDE / TOTAL) * 100).toFixed(1)
const antigravityRatio = ((PRE_AYNITE_ANTIGRAVITY / TOTAL) * 100).toFixed(1)

console.log()
console.log('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557')
console.log('  \u2551       Aynite Commit Summary Since Start      \u2551')
console.log('  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d')
console.log()
console.log(`   Since commit:  ${SINCE_COMMIT.slice(0, 12)}`)
console.log(`   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`)
console.log(`   Commits:       ${commitCount}`)
console.log(`   Files changed: ${filesChanged}`)
console.log(`   Lines added:   ${linesAdded}`)
console.log(`   Lines deleted: ${linesDeleted}`)
console.log(`   Net change:    ${linesAdded - linesDeleted >= 0 ? '+' : ''}${linesAdded - linesDeleted}`)
console.log()
console.log('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557')
console.log('  \u2551      Contribution Ratio (by authoring tool)   \u2551')
console.log('  \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d')
console.log()
console.log(
  `   Aynite + DeepSeek-V4-Flash    ${AYNITE_COMMITS.toString().padStart(4)} commits  (${ayniteRatio.padStart(5)}%)`,
)
console.log(
  `   Claude Code + DeepSeek-V4-Flash ${PRE_AYNITE_CLAUDE.toString().padStart(4)} commits  (${claudeRatio.padStart(5)}%)`,
)
console.log(
  `   Antigravity + Gemini           ${PRE_AYNITE_ANTIGRAVITY.toString().padStart(4)} commits  (${antigravityRatio.padStart(5)}%)`,
)
console.log(`   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`)
console.log(`   Total                          ${TOTAL.toString().padStart(4)} commits`)
console.log()
console.log(`   \u26a1 Aynite's share: ${ayniteRatio}% and growing!`)
console.log()
