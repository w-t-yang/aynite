import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const SRC_DIR = path.join(ROOT_DIR, 'src')

export interface Violation {
  file: string
  line?: number
  snippet?: string
  message: string
}

export interface WalkOptions {
  excludeDirs?: string[]
  excludeFiles?: string[]
  extensions?: string[]
}

/**
 * Recursively walks a directory and calls a callback for each file matching the extensions.
 */
export function walk(
  dir: string,
  callback: (filePath: string) => void,
  options: WalkOptions = {},
) {
  const {
    excludeDirs = ['node_modules', 'dist', '.git'],
    excludeFiles = [],
    extensions = ['.ts', '.tsx'],
  } = options

  if (!fs.existsSync(dir)) return

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relPath = path.relative(ROOT_DIR, fullPath)

    if (entry.isDirectory()) {
      if (
        !excludeDirs.some(
          (d) => entry.name === d || relPath === d || fullPath === d,
        )
      ) {
        walk(fullPath, callback, options)
      }
    } else {
      if (
        extensions.some((ext) => entry.name.endsWith(ext)) &&
        !excludeFiles.some(
          (f) => entry.name === f || relPath === f || fullPath === f,
        )
      ) {
        callback(fullPath)
      }
    }
  }
}

/**
 * Standardized report formatting for audit scripts.
 */
export function report(
  title: string,
  violations: Violation[],
  checkMode: boolean = false,
) {
  console.log('\n=================================================')
  console.log(`      ${title}`)
  console.log('=================================================\n')

  if (violations.length === 0) {
    console.log('✅ CLEAN: No architectural violations found.\n')
    process.exit(0)
  } else {
    console.log(`🚨 FAIL: Found ${violations.length} violation(s):\n`)
    violations.forEach((v) => {
      const loc = v.line ? `${v.file}:${v.line}` : v.file
      console.log(`[${loc}] ${v.snippet || ''}`)
      console.log(`   └─ ${v.message}\n`)
    })
    console.log('=================================================')
    console.log(`TOTAL VIOLATIONS: ${violations.length}\n`)
    if (checkMode) {
      process.exit(1)
    }
  }
}
