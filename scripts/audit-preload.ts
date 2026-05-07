import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const checkMode = process.argv.includes('--check')

interface Violation {
  file: string
  line: number
  snippet: string
}

const violations: Violation[] = []

function walk(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(ROOT, fullPath)

    if (entry.isDirectory()) {
      if (
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== '.git'
      ) {
        walk(fullPath)
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      // Whitelist preload/index.ts
      if (relPath === 'src/preload/index.ts') continue

      const content = fs.readFileSync(fullPath, 'utf-8')
      if (content.includes('ipcRenderer')) {
        const lines = content.split('\n')
        lines.forEach((line, idx) => {
          if (line.includes('ipcRenderer')) {
            violations.push({
              file: relPath,
              line: idx + 1,
              snippet: line.trim(),
            })
          }
        })
      }
    }
  }
}

console.log('\n=================================================')
console.log('      Aynite Preload Isolation Audit')
console.log('=================================================\n')

walk(SRC)

if (violations.length === 0) {
  console.log('✅ CLEAN: ipcRenderer usage is restricted to preload bridge.\n')
  process.exit(0)
} else {
  console.log(
    `🚨 FAIL: Found ${violations.length} forbidden ipcRenderer usage(s):\n`,
  )
  violations.forEach((v) => {
    console.log(`[${v.file}:${v.line}] ${v.snippet}`)
    console.log(`   └─ Move this IPC call to src/preload/index.ts bridge.\n`)
  })
  console.log('=================================================')
  console.log(`TOTAL VIOLATIONS: ${violations.length}\n`)
  if (checkMode) {
    process.exit(1)
  }
}
