import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, report, SRC_DIR, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const violations: any[] = []

function shouldExclude(name: string, snippet: string, file: string) {
  // 1. PascalCase components (and some PascalCase constants)
  if (file.endsWith('.tsx') && /^[A-Z][a-z]/.test(name)) return true

  // 2. React hooks
  if (name.startsWith('use')) return true

  // 3. Components via React patterns
  if (
    snippet.includes('React.FC') ||
    snippet.includes('React.memo') ||
    snippet.includes('forwardRef')
  )
    return true

  // 4. Utility functions (heuristic: contains '=>', 'function', or starts an arrow func with '(')
  if (
    snippet.includes('=>') ||
    snippet.includes('function') ||
    snippet.includes('= (')
  ) {
    return true
  }

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
              l.startsWith('import'),
          )
      ) {
        return
      }
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    // Match export const NAME = ...
    const regex = /export\s+const\s+([A-Za-z0-9_]+)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      const name = match[1]
      const lineNum = content.substring(0, match.index).split('\n').length
      const snippet = lines[lineNum - 1].trim()

      if (!shouldExclude(name, snippet, relPath)) {
        violations.push({
          file: relPath,
          line: lineNum,
          snippet,
          message: `Move "${name}" to src/lib/constants/`,
        })
      }
    }
  },
  {
    excludeDirs: ['node_modules', 'dist', '.git', 'src/lib/constants'],
  },
)

report('Aynite Constants Isolation Audit', violations, checkMode)
