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

/**
 * Files where hardcoded colors are intentional and legitimate:
 * - Chart/indicator color palettes (data visualization requires explicit colors)
 * - Theme preview demo data
 * - CSS variable fallback values
 * - Shadow/effect colors
 *
 * Each entry documents WHY the file is exempted. New files should NOT be added
 * here unless they have a similar legitimate need — this list should shrink, not grow.
 */
const EXEMPTED_FILES: Record<string, string> = {
  'src/renderer/views/datachart/DataChartPage.tsx':
    'Chart color palette entries and theme-conditional grid colors',
  'src/renderer/views/flow/FlowPage.tsx':
    'Node theme colors (data-driven, not UI styling)',
  'src/renderer/views/graph/GraphPage.tsx':
    'Graph node colors (data-driven, not UI styling)',
  'src/renderer/views/mindmap/MindMapPage.tsx':
    'MindMap node colors (data-driven, not UI styling)',
  'src/renderer/views/stockchart/ChartPage.tsx':
    'Technical indicator colors (data config, not UI styling)',
  'src/renderer/views/theme-studio/ThemeStudioPage.tsx':
    'Demo theme preview data (hardcoded color values are the content)',
}

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

  // Exempt specific files with documented legitimate reasons
  if (EXEMPTED_FILES[relativePath]) {
    return
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()

    // 1. Direct IPC Theme Change Audit
    if (line.includes('setConfig') && line.includes('activeTheme')) {
      violations.push({
        file: relativePath,
        line: lineNum,
        message: 'Direct IPC call to set activeTheme found.',
        suggestion:
          'Use setTheme(id) from useView() instead to ensure reactive updates.',
      })
    }

    // 2. Hardcoded Color Audit (in TSX/CSS)
    const matches = trimmedLine.match(COLOR_REGEX)
    if (
      matches &&
      !trimmedLine.startsWith('//') &&
      !trimmedLine.startsWith('*')
    ) {
      // ── Surgical line-level exemptions ──────────────────────────────────

      // CSS variable fallback: `|| '#fff'` or `|| "rgba(...`
      if (
        /\|\|[\s]*['"]#/.test(trimmedLine) ||
        /\|\|[\s]*['"]rgba?\(/.test(trimmedLine)
      ) {
        return
      }

      // Tailwind arbitrary shadow values: shadow-[...rgba(...]
      if (trimmedLine.includes('shadow-[') && /rgba?\(/.test(trimmedLine)) {
        return
      }

      // Ignore if it's a comment or a known allowed pattern (like mock data)
      if (!relativePath.includes('mocks') && !trimmedLine.includes('console.')) {
        violations.push({
          file: relativePath,
          line: lineNum,
          message: `Hardcoded color found: ${matches.join(', ')}`,
          suggestion:
            'Use CSS variables (e.g., var(--background)) or Tailwind semantic classes.',
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
    } else if (
      file.endsWith('.ts') ||
      file.endsWith('.tsx') ||
      file.endsWith('.css')
    ) {
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
  console.error(
    `❌ Audit Failed: Found ${violations.length} theme violations.\n`,
  )
  violations.forEach((v) => {
    console.error(`[${v.file}:${v.line}] ${v.message}`)
    if (v.suggestion) {
      console.error(`    💡 Suggestion: ${v.suggestion}`)
    }
  })
  process.exit(1)
}
