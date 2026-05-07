import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, report, SRC_DIR, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const violations: any[] = []

function isInternalType(_name: string, _snippet: string, _file: string) {
  // Common internal type patterns
  return false
}

walk(
  SRC_DIR,
  (fullPath) => {
    const relPath = path.relative(ROOT_DIR, fullPath)

    // Ignore index.ts re-exports
    if (path.basename(fullPath) === 'index.ts') {
      const content = fs.readFileSync(fullPath, 'utf-8')
      if (
        content
          .split('\n')
          .every(
            (l) =>
              !l.trim() ||
              l.startsWith('export * from') ||
              l.startsWith('import') ||
              l.startsWith('export {'),
          )
      ) {
        return
      }
    }

    // Ignore lib/constants/types.ts (some types live there)
    if (relPath === 'src/lib/constants/types.ts') return

    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    // Match export type|interface NAME
    const regex = /export\s+(type|interface)\s+([A-Za-z0-9_]+)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      const name = match[2]
      const lineNum = content.substring(0, match.index).split('\n').length
      const snippet = lines[lineNum - 1].trim()

      if (!isInternalType(name, snippet, relPath)) {
        violations.push({
          file: relPath,
          line: lineNum,
          snippet,
          message: `Move "${name}" to src/lib/types/`,
        })
      }
    }
  },
  {
    excludeDirs: ['node_modules', 'dist', '.git', 'src/lib/types'],
  },
)

report('Aynite Types Isolation Audit', violations, checkMode)
