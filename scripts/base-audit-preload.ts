import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, report, SRC_DIR, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const violations: any[] = []

walk(SRC_DIR, (fullPath) => {
  const relPath = path.relative(ROOT_DIR, fullPath)

  // Whitelist preload/index.ts
  if (relPath === 'src/preload/index.ts') return

  const content = fs.readFileSync(fullPath, 'utf-8')
  if (content.includes('ipcRenderer')) {
    const lines = content.split('\n')
    lines.forEach((line, idx) => {
      if (line.includes('ipcRenderer')) {
        violations.push({
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'Move this IPC call to src/preload/index.ts bridge.',
        })
      }
    })
  }
})

report('Aynite Preload Isolation Audit', violations, checkMode)
