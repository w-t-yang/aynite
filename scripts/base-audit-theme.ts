import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const RENDERER_VIEWS = path.join(ROOT, 'src/renderer/views')
const RENDERER_SHARED = path.join(ROOT, 'src/renderer/shared')

interface Violation {
  file: string
  line: number
  message: string
  suggestion?: string
}

const violations: Violation[] = []

// Regex for hex, rgb, rgba, hsl
const COLOR_REGEX = /(#[0-9a-fA-F]{3,8}|rgba?\(.*?\)|hsla?\(.*?\))/g

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const relativePath = path.relative(ROOT, filePath)
  
  // Skip theme definitions and utils that ARE allowed to have colors
  if (
    relativePath.includes('theme-handlers') || 
    relativePath.includes('utils.ts') || 
    relativePath.endsWith('.d.ts') ||
    relativePath.includes('styles/index.css') ||
    relativePath === 'src/renderer/views/ViewContext.tsx' ||
    relativePath === 'src/renderer/shared/basic/ColorPicker.tsx'
  ) {
    return
  }

  // Skip data visualization views — their colors are chart/indicator data,
  // theme preview data, or visual effect shadows, not theme violations
  const dataViewDirs = [
    'src/renderer/views/canvas',
    'src/renderer/views/datachart',
    'src/renderer/views/flow',
    'src/renderer/views/graph',
    'src/renderer/views/mindmap',
    'src/renderer/views/stockchart',
    'src/renderer/views/theme-studio',
  ]
  if (dataViewDirs.some((dir) => relativePath.startsWith(dir))) return

  // Skip DiffViewer — shadow rgba colors are visual effects, not theme colors
  if (relativePath.includes('DiffViewer.tsx')) return

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()

    // 1. Direct IPC Theme Change Audit
    if (line.includes('setConfig') && line.includes('activeTheme')) {
      violations.push({
        file: relativePath,
        line: lineNum,
        message: 'Direct IPC call to set activeTheme found.',
        suggestion: 'Use setTheme(id) from useView() instead to ensure reactive updates.',
      })
    }

    // 2. Hardcoded Color Audit (in TSX/CSS)
    // We only flag if it looks like a style assignment or tailwind arbitrary value
    const matches = trimmedLine.match(COLOR_REGEX)
    if (matches && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('*')) {
      // Ignore if it's a comment or a known allowed pattern (like mock data)
      if (!relativePath.includes('mocks') && !trimmedLine.includes('console.')) {
        violations.push({
          file: relativePath,
          line: lineNum,
          message: `Hardcoded color found: ${matches.join(', ')}`,
          suggestion: 'Use CSS variables (e.g., var(--background)) or Tailwind semantic classes.',
        })
      }
    }
  })
}

function scanDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) return
  const files = fs.readdirSync(dirPath)
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath)
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
      scanFile(fullPath)
    }
  })
}

// --- Run Audit ---

console.log('--- Starting Theme Architectural Audit ---')

scanDir(RENDERER_VIEWS)
scanDir(RENDERER_SHARED)

// --- Report ---

if (violations.length === 0) {
  console.log('✅ Audit Passed: Theme usage is compliant.')
  process.exit(0)
} else {
  console.error(`❌ Audit Failed: Found ${violations.length} theme violations.\n`)
  violations.forEach((v) => {
    console.error(`[${v.file}:${v.line}] ${v.message}`)
    if (v.suggestion) {
      console.error(`    💡 Suggestion: ${v.suggestion}`)
    }
  })
  process.exit(1)
}
