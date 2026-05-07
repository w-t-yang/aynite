import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, report, SRC_DIR, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const violations: any[] = []

walk(SRC_DIR, (fullPath) => {
  const relPath = path.relative(ROOT_DIR, fullPath)

  // Whitelist src/lib/path.ts
  if (relPath === 'src/lib/path.ts') return

  const content = fs.readFileSync(fullPath, 'utf-8')

  // Look for any import of 'path' or 'node:path'
  const pathImportRegex = /from\s+['"](node:)?path['"]/g
  const pathRequireRegex = /require\(['"](node:)?path['"]\)/g

  const lines = content.split('\n')
  lines.forEach((line, idx) => {
    if (pathImportRegex.test(line) || pathRequireRegex.test(line)) {
      violations.push({
        file: relPath,
        line: idx + 1,
        snippet: line.trim(),
        message:
          'Direct use of "path" module is forbidden. Import helpers from src/lib/path.ts instead.',
      })
    }
  })
})

report('Aynite Path Isolation Audit', violations, checkMode)
