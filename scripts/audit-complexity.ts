#!/usr/bin/env tsx
/**
 * Complexity Budget Audit
 *
 * Measures every function/component in the codebase and flags those
 * exceeding simplification thresholds. Generates a ranked refactoring list.
 *
 * Thresholds:
 *   🔴 High   — function > 40 lines, cyclomatic > 8, parameters > 4
 *   🟡 Medium — function > 25 lines, cyclomatic > 5, parameters > 3
 *
 * Usage:
 *   tsx scripts/audit-complexity.ts
 *   tsx scripts/audit-complexity.ts --json
 *   tsx scripts/audit-complexity.ts --min-lines=50  # custom threshold
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const jsonOutput = process.argv.includes('--json')

// Parse custom thresholds from args
const parseThreshold = (flag: string, defaultVal: number): number => {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`))
  return arg ? Number.parseInt(arg.split('=')[1], 10) : defaultVal
}

const THRESHOLD_LINES_HIGH = parseThreshold('min-lines', 40)
const THRESHOLD_LINES_MED = parseThreshold('min-lines-med', 25)
const THRESHOLD_CYCLO_HIGH = parseThreshold('min-cyclo', 8)
const THRESHOLD_CYCLO_MED = parseThreshold('min-cyclo-med', 5)
const THRESHOLD_PARAMS_HIGH = parseThreshold('min-params', 4)
const THRESHOLD_PARAMS_MED = parseThreshold('min-params-med', 3)

interface FunctionMetric {
  name: string
  file: string
  line: number
  lines: number
  cyclomaticComplexity: number
  parameters: number
  inlineHandlers: number // JSX inline arrow functions
  severity: 'high' | 'medium'
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

// ─── Complexity analysis ────────────────────────────────────────────────────

function countCyclomatic(body: string): number {
  const decisions =
    // if, else if, for, while, catch, switch
    (body.match(/\b(if\s*\(|for\s*\(|while\s*\(|catch\s*\(|switch\s*\()/g)
      ?.length || 0) +
    // case labels (but not default)
    (body.match(/\bcase\s+\w+/g)?.length || 0) +
    // ternary
    (body.match(/\?\s*\S+\s*:/g)?.length || 0)

  // Logical operators inside conditions are harder to track without an AST,
  // so we use a conservative heuristic: count && and || at the start of lines
  // or after opening parens (likely condition context)
  const logicalConditions =
    (body.match(/\([^)]*\|\|/g)?.length || 0) +
    (body.match(/\([^)]*&&/g)?.length || 0)

  return decisions + logicalConditions + 1 // base complexity is 1
}

function countParameters(sig: string): number {
  // Extract text between the first paren pair after the function name
  const parenMatch = sig.match(/\(([^)]*)\)/)
  if (!parenMatch) return 0
  const params = parenMatch[1].trim()
  if (!params || params === '') return 0
  // Split by comma, but handle destructuring with default values carefully
  // Simple heuristic: count top-level commas not inside braces
  let depth = 0
  let commas = 0
  for (const ch of params) {
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') depth--
    else if (ch === ',' && depth === 0) commas++
  }
  return commas + 1
}

function countInlineJsxHandlers(body: string): number {
  // Count on*={(...) => ...} patterns — inline event handlers in JSX
  const handlers = body.match(/on\w+=\{(\([^)]*\)\s*=>|\(?\w+\)?\s*=>\s*\{)/g)
  return handlers?.length || 0
}

function findFunctions(
  content: string,
  filepath: string,
): Omit<FunctionMetric, 'severity'>[] {
  const lines = content.split('\n')
  const functions: Omit<FunctionMetric, 'severity'>[] = []

  // Patterns to match function starts:
  // 1. export function name( | function name(
  // 2. name = (params) => { | name = function( | const name = (
  // 3. name(params) {  (method shorthand)
  // 4. name: (params) => { (object method)

  const funcPatterns = [
    /^(export\s+)?(async\s+)?function\s+(\w+)\s*\(/,
    /^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>\s*\{/,
    /^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s+)?function\s*\(/,
    /^\s+(\w+)\s*\([^)]*\)\s*\{/, // method shorthand (inside a class/object)
    /^\s+(\w+)\s*:\s*(async\s+)?\([^)]*\)\s*=>\s*\{/, // object property method
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let match: RegExpMatchArray | null = null
    let funcName = ''

    for (const pattern of funcPatterns) {
      match = line.match(pattern)
      if (match) {
        // The name is either the first capture (patterns 1,2,3) or the second
        funcName = match[match.length - 1]
        break
      }
    }

    if (!match) {
      // Check for React component: export default function or const Component
      const componentMatch = line.match(
        /^(export\s+default\s+)?function\s+([A-Z]\w+)\s*\(/,
      )
      if (componentMatch) {
        funcName = componentMatch[2]
        match = componentMatch
      }
    }

    if (!match || !funcName) continue

    // Find the body start — the first `{` after the function declaration
    // Handle cases where the signature spans multiple lines
    let braceStart = line.indexOf('{', match.index! + match[0].length)

    // If no brace on this line, scan forward
    if (braceStart === -1) {
      let j = i + 1
      while (j < lines.length) {
        const bracePos = lines[j].indexOf('{')
        if (bracePos !== -1) {
          braceStart = bracePos
          break
        }
        j++
      }
    }

    if (braceStart === -1) continue // no body found (maybe an interface or type)

    // Track brace depth from the body start to find the matching closing brace
    const bodyStartLine = i
    let braceDepth = 0
    let bodyEndLine = i
    let foundOpening = false

    for (let j = bodyStartLine; j < lines.length; j++) {
      for (let c = 0; c < lines[j].length; c++) {
        if (lines[j][c] === '{') {
          braceDepth++
          if (!foundOpening && j >= i) foundOpening = true
        } else if (lines[j][c] === '}') {
          braceDepth--
          if (foundOpening && braceDepth === 0) {
            bodyEndLine = j
            j = lines.length // break outer
            break
          }
        }
      }
    }

    // Extract the function signature (from the matched line to the '{')
    let sig = line
    if (braceStart > 0) {
      sig = line.substring(0, braceStart).trim()
    }

    // Extract the body for complexity analysis
    const bodyLines = lines.slice(bodyStartLine, bodyEndLine + 1)
    const bodyText = bodyLines.join('\n')

    // Build parameter string, handling multi-line signatures
    let paramStr = sig
    if (!paramStr.includes(')')) {
      // Multi-line signature: scan forward to find the closing paren
      for (let j = i + 1; j < lines.length; j++) {
        paramStr += lines[j].trim()
        if (lines[j].includes(')')) break
      }
    }

    const paramCount = countParameters(paramStr)
    const cycloComplexity = countCyclomatic(bodyText)
    const inlineCount = countInlineJsxHandlers(bodyText)
    const lineCount = bodyEndLine - bodyStartLine + 1

    functions.push({
      name: funcName,
      file: path.relative(ROOT, filepath),
      line: i + 1,
      lines: lineCount,
      cyclomaticComplexity: cycloComplexity,
      parameters: paramCount,
      inlineHandlers: inlineCount,
    })
  }

  return functions
}

// ─── Threshold check ────────────────────────────────────────────────────────

function assess(fn: Omit<FunctionMetric, 'severity'>): FunctionMetric {
  const high =
    fn.lines >= THRESHOLD_LINES_HIGH ||
    fn.cyclomaticComplexity >= THRESHOLD_CYCLO_HIGH ||
    fn.parameters >= THRESHOLD_PARAMS_HIGH

  const med =
    fn.lines >= THRESHOLD_LINES_MED ||
    fn.cyclomaticComplexity >= THRESHOLD_CYCLO_MED ||
    fn.parameters >= THRESHOLD_PARAMS_MED

  return { ...fn, severity: high ? 'high' : med ? 'medium' : 'medium' }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const srcDir = path.join(ROOT, 'src')
  const files = walk(srcDir)

  const allMetrics: FunctionMetric[] = []

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    const functions = findFunctions(content, file)
    for (const fn of functions) {
      const assessed = assess(fn)
      if (assessed.severity === 'high' || assessed.severity === 'medium') {
        allMetrics.push(assessed)
      }
    }
  }

  // Sort: high first, then by lines descending
  allMetrics.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
    return b.lines - a.lines
  })

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          thresholds: {
            linesHigh: THRESHOLD_LINES_HIGH,
            linesMed: THRESHOLD_LINES_MED,
            cycloHigh: THRESHOLD_CYCLO_HIGH,
            cycloMed: THRESHOLD_CYCLO_MED,
            paramsHigh: THRESHOLD_PARAMS_HIGH,
            paramsMed: THRESHOLD_PARAMS_MED,
          },
          functions: allMetrics,
          summary: {
            total: allMetrics.length,
            high: allMetrics.filter((m) => m.severity === 'high').length,
            medium: allMetrics.filter((m) => m.severity === 'medium').length,
          },
        },
        null,
        2,
      ),
    )
    return
  }

  console.log('\n=================================================')
  console.log('   Complexity Budget Audit')
  console.log(
    `   Thresholds: >${THRESHOLD_LINES_HIGH}L / >${THRESHOLD_CYCLO_HIGH}C / >${THRESHOLD_PARAMS_HIGH}P (high)`,
  )
  console.log(
    `               >${THRESHOLD_LINES_MED}L / >${THRESHOLD_CYCLO_MED}C / >${THRESHOLD_PARAMS_MED}P (medium)`,
  )
  console.log('=================================================\n')

  const high = allMetrics.filter((m) => m.severity === 'high')
  const med = allMetrics.filter((m) => m.severity === 'medium')

  if (high.length > 0) {
    console.log(`🔴 HIGH PRIORITY (${high.length})\n`)
    for (const fn of high) {
      console.log(`   ${fn.name.padEnd(30)} ${fn.file}:${fn.line}`)
      console.log(
        `   └─ ${fn.lines} lines, cyclomatic ${fn.cyclomaticComplexity}, ${fn.parameters} params${fn.inlineHandlers > 0 ? `, ${fn.inlineHandlers} inline handlers` : ''}`,
      )
      console.log()
    }
  }

  if (med.length > 0) {
    console.log(`🟡 MEDIUM PRIORITY (${med.length})\n`)
    for (const fn of med.slice(0, 20)) {
      console.log(
        `   ${fn.name.padEnd(30)} ${fn.file}:${fn.line}  — ${fn.lines}L, C=${fn.cyclomaticComplexity}, P=${fn.parameters}`,
      )
    }
    if (med.length > 20) {
      console.log(`   ... and ${med.length - 20} more`)
    }
    console.log()
  }

  console.log('=================================================')
  console.log(
    `   Total: ${allMetrics.length} functions flagged (${high.length} high, ${med.length} medium)`,
  )
  console.log(
    `   ${allMetrics.length === 0 ? '✅ All within budget' : '📋 Review the list and refactor top items'}`,
  )
  console.log()
}

main()
