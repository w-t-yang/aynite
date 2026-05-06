#!/usr/bin/env tsx
/**
 * Export Surface Analyzer
 *
 * Finds exports that are only consumed within their own directory.
 * These are candidates for making private, reducing the module's
 * public API surface and enabling easier refactoring.
 *
 * Also flags barrel files (index.ts) that re-export a single module
 * without adding value.
 *
 * Usage:
 *   tsx scripts/audit-exports.ts
 *   tsx scripts/audit-exports.ts --json
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const jsonOutput = process.argv.includes('--json')

interface ExportEntry {
  name: string
  file: string
  kind: 'value' | 'type' | 'default'
  importers: string[] // files that import it
}

interface AuditReport {
  internalExports: ExportEntry[] // exported but only used within same directory
  unnecessaryBarrels: string[] // barrel files re-exporting one thing
  deadExports: ExportEntry[] // exported but never imported anywhere
}

// ─── File walk ──────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walk(full))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(full)
    }
  }
  return files
}

// ─── Parse exports ──────────────────────────────────────────────────────────

function parseExports(content: string, filepath: string): ExportEntry[] {
  const exports: ExportEntry[] = []
  const lines = content.split('\n')
  const relPath = path.relative(ROOT, filepath)
  const _dir = path.dirname(filepath)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // export function name
    let m = line.match(/^export\s+function\s+(\w+)/)
    if (m) {
      exports.push({ name: m[1], file: relPath, kind: 'value', importers: [] })
      continue
    }

    // export const name / export let name / export var name
    m = line.match(/^export\s+(const|let|var)\s+(\w+)/)
    if (m) {
      exports.push({ name: m[2], file: relPath, kind: 'value', importers: [] })
      continue
    }

    // export interface name / export type name
    m = line.match(/^export\s+(interface|type)\s+(\w+)/)
    if (m) {
      exports.push({ name: m[2], file: relPath, kind: 'type', importers: [] })
      continue
    }

    // export class name
    m = line.match(/^export\s+class\s+(\w+)/)
    if (m) {
      exports.push({ name: m[1], file: relPath, kind: 'value', importers: [] })
      continue
    }

    // export default ...
    m = line.match(/^export\s+default\s+(function|const|class)\s+(\w+)/)
    if (m) {
      exports.push({
        name: m[2],
        file: relPath,
        kind: 'default',
        importers: [],
      })
      continue
    }

    // export default function ComponentName — handle span lines
    m = line.match(/^export\s+default\s+(function|class)\s+(\w+)/)
    if (m) {
      exports.push({
        name: m[2],
        file: relPath,
        kind: 'default',
        importers: [],
      })
    }
  }

  return exports
}

// ─── Parse imports ──────────────────────────────────────────────────────────

function parseImports(content: string): string[] {
  const imports: string[] = []
  const patterns = [
    /import\s+(?:\{[^}]*\}|[^;{]+)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+type\s+(?:\{[^}]*\}|[^;{]+)\s+from\s+['"]([^'"]+)['"]/g,
  ]

  for (const pattern of patterns) {
    let m: RegExpExecArray | null
    while ((m = pattern.exec(content)) !== null) {
      imports.push(m[1])
    }
  }
  return imports
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const srcDir = path.join(ROOT, 'src')
  const files = walk(srcDir)

  // Phase 1: collect all exports
  const allExports: Map<string, ExportEntry> = new Map()
  const exportKey = (file: string, name: string) => `${file}|${name}`

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const exports = parseExports(content, file)
    for (const exp of exports) {
      allExports.set(exportKey(exp.file, exp.name), exp)
    }
  }

  // Phase 2: resolve import paths to actual files
  const importToFile = (importPath: string, importerFile: string): string[] => {
    if (!importPath.startsWith('.')) return [] // external package
    const importerDir = path.dirname(path.resolve(ROOT, importerFile))
    const resolved = path.resolve(importerDir, importPath)
    // Try with extensions
    const candidates = ['.ts', '.tsx', '/index.ts', '/index.tsx']
    for (const ext of candidates) {
      const full = resolved + ext
      if (fs.existsSync(full)) {
        return [path.relative(ROOT, full)]
      }
      // Check if it's a directory with an index file
      if (ext.startsWith('/')) {
        const dir = resolved
        const indexPath = dir + ext
        if (fs.existsSync(indexPath)) {
          return [path.relative(ROOT, indexPath)]
        }
      }
    }
    return [] // not found
  }

  // Phase 3: register importers
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const imports = parseImports(content)
    const relPath = path.relative(ROOT, file)

    for (const imp of imports) {
      const resolvedFiles = importToFile(imp, relPath)
      for (const rf of resolvedFiles) {
        // This import _might_ reference any export from the target file
        // We add the importer to all exports of the target file
        for (const [_key, exp] of allExports) {
          if (exp.file === rf && !exp.importers.includes(relPath)) {
            exp.importers.push(relPath)
          }
        }
      }
    }
  }

  // Phase 4: classify exports
  const report: AuditReport = {
    internalExports: [],
    unnecessaryBarrels: [],
    deadExports: [],
  }

  for (const [, exp] of allExports) {
    const fileDir = path.dirname(exp.file)
    const externalImporters = exp.importers.filter(
      (imp) => path.dirname(imp) !== fileDir,
    )

    if (exp.importers.length === 0) {
      // Check if it's a barrel re-exporting a single thing
      if (exp.file.endsWith('/index.ts')) {
        report.unnecessaryBarrels.push(exp.file)
      } else {
        report.deadExports.push(exp)
      }
    } else if (externalImporters.length === 0) {
      // Used, but only within its own directory
      if (!exp.file.endsWith('/index.ts')) {
        // Skip barrel files — they're supposed to re-export
        report.internalExports.push(exp)
      }
    }
  }

  // ── Output ──

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log('\n=================================================')
  console.log('   Export Surface Analysis')
  console.log('=================================================\n')

  if (report.deadExports.length > 0) {
    console.log(
      `🗑️  NEVER IMPORTED (${report.deadExports.length}) — could be deleted\n`,
    )
    for (const exp of report.deadExports) {
      console.log(`   ${exp.name.padEnd(30)} ${exp.file}`)
    }
    console.log()
  }

  if (report.internalExports.length > 0) {
    console.log(
      `🔒 INTERNAL ONLY (${report.internalExports.length}) — could be made private\n`,
    )
    for (const exp of report.internalExports) {
      console.log(`   ${exp.name.padEnd(30)} ${exp.file}`)
    }
    console.log()
  }

  if (report.unnecessaryBarrels.length > 0) {
    console.log(
      `📦 SINGLE-EXPORT BARRELS (${report.unnecessaryBarrels.length})\n`,
    )
    for (const f of report.unnecessaryBarrels) {
      console.log(`   ${f}`)
    }
    console.log()
  }

  if (
    report.deadExports.length === 0 &&
    report.internalExports.length === 0 &&
    report.unnecessaryBarrels.length === 0
  ) {
    console.log('✅ All exports have external consumers — clean surface.\n')
  } else {
    console.log('=================================================')
    console.log(
      `   Total: ${report.deadExports.length} dead, ${report.internalExports.length} internal-only, ${report.unnecessaryBarrels.length} unnecessary barrels`,
    )
    console.log()
  }
}

main()
