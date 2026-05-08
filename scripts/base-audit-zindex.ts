import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, report, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const RENDERER_DIR = path.join(ROOT_DIR, 'src/renderer')

const violations: any[] = []

// Whitelist of allowed z-index classes
const WHITELIST = [
  'z-base',
  'z-layout',
  'z-splitter',
  'z-popover',
  'z-modal',
  'z-auto', // Tailwind default for resetting
]

// Regex to find z-index usage
// 1. z-XX (literal numbers)
// 2. z-[XX] (arbitrary values)
const Z_INDEX_REGEX = /z-(?:\[[\w-]+\]|\d+)/g

walk(
  RENDERER_DIR,
  (fullPath) => {
    const relPath = path.relative(ROOT_DIR, fullPath)
    const content = fs.readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const matches = line.match(Z_INDEX_REGEX)

      if (matches) {
        for (const match of matches) {
          if (!WHITELIST.includes(match)) {
            violations.push({
              file: relPath,
              line: i + 1,
              snippet: match,
              message: `Illegal literal or arbitrary z-index used: "${match}". Use semantic tokens (z-base, z-layout, z-splitter, z-popover, z-modal) instead.`,
            })
          }
        }
      }
    }
  },
  {
    extensions: ['.tsx', '.ts', '.css'],
    excludeDirs: ['node_modules', 'dist', '.git', 'tests'],
  },
)

report('Aynite Z-Index Architecture Audit', violations, checkMode)
