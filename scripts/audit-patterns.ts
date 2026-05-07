#!/usr/bin/env tsx
/**
 * Micro-Pattern Simplification Detector
 *
 * Finds small, specific code patterns that signal missed simplifications.
 * Each detector is a lightweight regex scan — fast, pragmatic, actionable.
 *
 * Detectors:
 *   boolean-prop   — prop={true} should be just prop
 *   double-negate  — !!x where x is already boolean
 *   then-chain     — .then() chains that could be async/await
 *   nested-ternary — ternary chains (a ? b : c ? d : e) > 2 levels
 *   pass-through   — component receives prop and passes unchanged to child
 *   template-dup   — repeated Tailwind class combinations (3+ classes)
 *   spread-syntax  — {...props} spreading that bypasses type safety
 *
 * Usage:
 *   tsx scripts/audit-patterns.ts
 *   tsx scripts/audit-patterns.ts --focus=boolean-prop,then-chain
 *   tsx scripts/audit-patterns.ts --json
 *   tsx scripts/audit-patterns.ts --check
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const jsonOutput = process.argv.includes('--json')
const checkMode = process.argv.includes('--check')

const focusArg = process.argv
  .find((a) => a.startsWith('--focus='))
  ?.split('=')[1]
const activeDetectors = focusArg?.split(',') ?? null

interface Finding {
  detector: string
  file: string
  line: number
  snippet: string
  message: string
  severity: 'high' | 'medium' | 'info'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))
      files.push(full)
  }
  return files
}

function isActive(name: string): boolean {
  return !activeDetectors || activeDetectors.includes(name)
}

// ─── Detectors ──────────────────────────────────────────────────────────────

interface Detector {
  name: string
  label: string
  severity: 'high' | 'medium' | 'info'
  run: (content: string, filepath: string) => Finding[]
}

const DETECTORS: Detector[] = [
  // 1. Boolean prop shorthand: prop={true} → prop
  {
    name: 'boolean-prop',
    label: 'Boolean prop shorthand',
    severity: 'info',
    run: (content, filepath) => {
      const findings: Finding[] = []
      const regex = /(\w+)=\{true\}/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        const line = content.substring(0, m.index).split('\n').length
        findings.push({
          detector: 'boolean-prop',
          file: filepath,
          line,
          snippet: content.split('\n')[line - 1].trim().substring(0, 80),
          message: `"${m[1]}={true}" → just "${m[1]}"`,
          severity: 'info',
        })
      }
      return findings
    },
  },

  // 2. Double negation: !!x where x is already boolean
  {
    name: 'double-negate',
    label: 'Double negation',
    severity: 'info',
    run: (content, filepath) => {
      const findings: Finding[] = []
      const regex = /!!\(?([a-zA-Z]\w*(?:\.[a-zA-Z]\w*)*)\)?/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        const line = content.substring(0, m.index).split('\n').length
        findings.push({
          detector: 'double-negate',
          file: filepath,
          line,
          snippet: content.split('\n')[line - 1].trim().substring(0, 80),
          message: `!!${m[1]} — if ${m[1]} is already boolean, remove !!`,
          severity: 'info',
        })
      }
      return findings
    },
  },

  // 3. .then() chains: promise.then(x => ...) could be async
  {
    name: 'then-chain',
    label: 'Then-chain to async/await',
    severity: 'medium',
    run: (content, filepath) => {
      const findings: Finding[] = []
      const regex = /\.then\(\(?(\w+)\)?\s*=>/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        const line = content.substring(0, m.index).split('\n').length
        findings.push({
          detector: 'then-chain',
          file: filepath,
          line,
          snippet: content.split('\n')[line - 1].trim().substring(0, 80),
          message: `.then() chain could be async/await`,
          severity: 'medium',
        })
      }
      return findings
    },
  },

  // 4. Nested ternary: a ? b : c ? d : e  (on a single line, in JS context)
  {
    name: 'nested-ternary',
    label: 'Nested ternary chain',
    severity: 'high',
    run: (content, filepath) => {
      const findings: Finding[] = []
      // Match: expression ? truthy : falsy_expr ? nested :
      // The key: after the first `:` there's another `?` on the same line
      const regex = /\.*[?]\s*[^:;)\]{]+[ ]*:[ ]*[^:;)\]{]+[ ]*[?]\s/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        const lineNum = content.substring(0, m.index).split('\n').length
        findings.push({
          detector: 'nested-ternary',
          file: filepath,
          line: lineNum,
          snippet: content.split('\n')[lineNum - 1].trim().substring(0, 80),
          message: 'Nested ternary chain — extract to function or lookup map',
          severity: 'high',
        })
      }
      return findings
    },
  },

  // 5. Props pass-through: <Child prop={prop}> where parent receives `prop`
  {
    name: 'pass-through',
    label: 'Props pass-through',
    severity: 'medium',
    run: (content, filepath) => {
      const findings: Finding[] = []
      // Find components that are passed a prop matching their own destructured param
      // Pattern: function Comp({ prop, ... }) { ... <Child prop={prop}> ... }
      const fnMatch = content.match(
        /(?:function|const)\s+\w+[^=]*=\s*\([^)]*\{(\w+)\}[^)]*\)/,
      )
      if (!fnMatch) return findings
      const propName = fnMatch[1]
      // Check if this prop is passed to a child unchanged
      const usage = new RegExp(
        `<\\w+[^>]*\\b${propName}=\\{${propName}\\}`,
        'g',
      )
      let m: RegExpExecArray | null
      while ((m = usage.exec(content)) !== null) {
        // Verify the parent doesn't use the prop before passing it
        const line = content.substring(0, m.index).split('\n').length
        findings.push({
          detector: 'pass-through',
          file: filepath,
          line,
          snippet: content.split('\n')[line - 1].trim().substring(0, 80),
          message: `Prop "${propName}" passed through unchanged — child could own this prop`,
          severity: 'medium',
        })
      }
      return findings
    },
  },

  // 6. Repeated Tailwind class combinations
  {
    name: 'template-dup',
    label: 'Repeated Tailwind class combo',
    severity: 'medium',
    run: (_content, _filepath) => {
      // This runs at file level, collected in main pass
      return [] // handled in main
    },
  },

  // 7. Spread props bypassing type safety
  {
    name: 'spread-syntax',
    label: 'Props spread',
    severity: 'info',
    run: (content, filepath) => {
      const findings: Finding[] = []
      const regex = /\{\.\.\.(props|rest|[a-z]+Props)\}/g
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        const line = content.substring(0, m.index).split('\n').length
        findings.push({
          detector: 'spread-syntax',
          file: filepath,
          line,
          snippet: content.split('\n')[line - 1].trim().substring(0, 80),
          message:
            m[1] === 'props'
              ? '{...props} spread — consider explicit forwarding'
              : `{...${m[1]}} spread`,
          severity: 'info',
        })
      }
      return findings
    },
  },
]

// ─── Tailwind duplication analyzer ──────────────────────────────────────────

function analyzeTailwindDuplicates(files: string[]): Finding[] {
  // Collect all className strings grouped by file
  const classMap = new Map<string, string[]>()
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const classes: string[] = []
    const regex = /className="([^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(content)) !== null) {
      if (m[1].split(/\s+/).length >= 3) {
        classes.push(m[1])
      }
    }
    if (classes.length > 0) classMap.set(file, classes)
  }

  // Build frequency map across files
  const freq = new Map<string, Set<string>>()
  for (const [file, classes] of classMap) {
    for (const cls of classes) {
      if (!freq.has(cls)) freq.set(cls, new Set())
      freq.get(cls)?.add(file)
    }
  }

  const findings: Finding[] = []
  for (const [cls, files] of freq) {
    if (files.size >= 2) {
      for (const file of files) {
        findings.push({
          detector: 'template-dup',
          file,
          line: 0,
          snippet: cls.substring(0, 80),
          message: `Class combo appears ${files.size}x across files — extract to shared className constant`,
          severity: 'medium',
        })
      }
    }
  }

  return findings
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const srcDir = path.join(ROOT, 'src')
  const files = walk(srcDir)

  const allFindings: Finding[] = []

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const relPath = path.relative(ROOT, file)

    for (const detector of DETECTORS) {
      if (!isActive(detector.name)) continue
      const findings = detector.run(content, relPath)
      allFindings.push(...findings)
    }
  }

  // Tailwind duplication (cross-file, run separately)
  if (isActive('template-dup')) {
    const tdFindings = analyzeTailwindDuplicates(files)
    allFindings.push(...tdFindings)
  }

  // Sort: high → medium → info, then by file
  const severityOrder = { high: 0, medium: 1, info: 2 }
  allFindings.sort((a, b) => {
    const sa = severityOrder[a.severity]
    const sb = severityOrder[b.severity]
    if (sa !== sb) return sa - sb
    return a.file.localeCompare(b.file) || a.line - b.line
  })

  // Group for report
  const grouped = new Map<string, Finding[]>()
  for (const f of allFindings) {
    if (!grouped.has(f.detector)) grouped.set(f.detector, [])
    grouped.get(f.detector)?.push(f)
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          detectors: Object.fromEntries(grouped),
          summary: {
            total: allFindings.length,
            high: allFindings.filter((f) => f.severity === 'high').length,
            medium: allFindings.filter((f) => f.severity === 'medium').length,
            info: allFindings.filter((f) => f.severity === 'info').length,
          },
        },
        null,
        2,
      ),
    )
    return
  }

  console.log('\n=================================================')
  console.log('   Micro-Pattern Simplification Detector')
  activeDetectors && console.log(`   Focus: ${activeDetectors.join(', ')}`)
  console.log('=================================================\n')

  const order = [
    'nested-ternary',
    'then-chain',
    'pass-through',
    'template-dup',
    'boolean-prop',
    'double-negate',
    'spread-syntax',
  ]

  for (const name of order) {
    const items = grouped.get(name)
    if (!items || items.length === 0) continue
    const detector = DETECTORS.find((d) => d.name === name)
    if (!detector) continue
    const badge =
      detector.severity === 'high'
        ? '🔴'
        : detector.severity === 'medium'
          ? '🟡'
          : 'ℹ️'

    console.log(`${badge} ${detector.label} (${items.length})\n`)
    for (const item of items.slice(0, 8)) {
      const loc = item.line ? `${item.file}:${item.line}` : item.file
      console.log(`   ${loc}`)
      console.log(`   └─ ${item.snippet}`)
      if (item.line === 0) console.log(`   └─ ${item.message}`)
      console.log()
    }
    if (items.length > 8) {
      console.log(`   ... and ${items.length - 8} more`)
      console.log()
    }
  }

  const high = allFindings.filter((f) => f.severity === 'high').length
  const medium = allFindings.filter((f) => f.severity === 'medium').length
  const info = allFindings.filter((f) => f.severity === 'info').length

  console.log('=================================================')
  console.log(
    `   Total: ${allFindings.length} patterns (${high} high, ${medium} medium, ${info} info)`,
  )
  console.log()

  if (checkMode && (high > 0 || medium > 0)) {
    process.exit(1)
  }
}

main()
