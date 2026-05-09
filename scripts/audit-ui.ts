import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Handling __dirname for ES modules/tsx
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT_DIR = path.resolve(__dirname, '..')
const SHARED_DIR = path.join(ROOT_DIR, 'src/renderer/shared')
const VIEWS_DIR = path.join(ROOT_DIR, 'src/renderer/views')
const SRC_DIR = path.join(ROOT_DIR, 'src/renderer/src')

interface AuditIssue {
  type: string
  file: string
  line: number
  snippet: string
  message: string
}

interface ViolationRule {
  key: string
  name: string
  description: string
  regex?: RegExp
  anyRegex?: RegExp
  textNodeRegex?: RegExp
  propRegex?: RegExp
  tags?: string[]
}

const VIOLATIONS = {
  IMPORT_HIERARCHY: {
    key: 'import',
    name: 'Import Hierarchy Violation',
    description:
      'Enforce strict import layering (lib -> basic -> featured -> pages -> views).',
  },
  STRICT_TYPING: {
    key: 'types',
    name: 'Strict Typing Violation',
    anyRegex: /\bany\b/g,
    description:
      'Avoid use of "any". Use more specific types (e.g., define proper interfaces instead).',
  },
  HARDCODED_STRINGS: {
    key: 'strings',
    name: 'Potential Hardcoded Strings',
    textNodeRegex: />([^<{}]+)</g,
    propRegex: /\b(label|title|placeholder|description|text)="([^"]+)"/g,
    description:
      'Consider moving hardcoded user-facing strings to a constants file or i18n system.',
  },
  COMPONENT_DUPLICATION: {
    key: 'tags',
    name: 'Manual HTML Component Usage',
    tags: ['button', 'input', 'select', 'textarea'],
    description:
      'Use shared/basic components (Button, Input, Select, SelectionList) instead of raw HTML tags or manual menus.',
  },
  ADAPTIVE_STYLES: {
    key: 'styles',
    name: 'Adaptive/Responsive Styles',
    regex: /\b(sm|md|lg|xl|2xl):[a-zA-Z]/g,
    description:
      'Avoid using responsive Tailwind prefixes (sm:, md:, etc.) in the shared directory to maintain a stable fixed-width layout.',
  },
  SYSTEM_CALLS: {
    key: 'system',
    name: 'System Alert/Confirm Usage',
    regex: /\b(alert|confirm)\s*\(/g,
    description:
      'Use shared/basic components or modals instead of native browser popups.',
  },
  DIRECT_PATH_IMPORT: {
    key: 'path-import',
    name: 'Direct Path Module Import',
    regex: /import\s+.*\s+from\s+['"]path['"]/g,
    description:
      'Avoid direct "path" module imports. Use standardized path helpers from src/lib/path.ts instead.',
  },
  FORBIDDEN_PATH_FUNCTIONS: {
    key: 'path-func',
    name: 'Forbidden Path Functions',
    regex:
      /(?<!\.)\b(?:join|dirname|resolve|extname|basename)\b(?!\s*:)(?=\s*\()|(?<!\.)\bsep\b(?!\s*:)/g,
    description:
      'Do not use raw path functions (join, dirname, etc.). Use project-specific path getters or their abstracted wrappers (joinPaths, getDirname, etc.) from lib/path.ts.',
  },
  Z_INDEX_HIERARCHY: {
    key: 'z-index',
    name: 'Z-Index Hierarchy Violation',
    regex: /\bz-\[?(\d+)\]?|\bzIndex\s*:\s*(\d+)/g,
    description:
      'Enforce standardized z-index layers: Splitters (100), Menus (2000-3000), Notifications (4000), Modals (5000), Context Menus (6000).',
  },
  ANIMATION_EFFECTS: {
    key: 'animation',
    name: 'Animation/Transition Effects',
    regex: /\b(transition|duration)-[a-z0-9]+/g,
    description:
      'Avoid manual transition or duration classes. Use standardized animation primitives or maintain a static UI for consistency.',
  },
  BACKGROUND_COLORS: {
    key: 'bg-colors',
    name: 'Background Color Usage',
    regex: /\bbg-[a-z0-9-]+/g,
    description:
      'Audit usage of background color utilities in views to ensure theme consistency.',
  },
  LEGACY_MESSAGING: {
    key: 'messaging',
    name: 'Legacy Messaging Usage',
    regex: /\bpostMessage\s*\(|\baddEventListener\s*\(/g,
    description:
      'Avoid postMessage or manual event listeners. Use direct Electron IPC (window.aynite) or standardized React hooks instead.',
  },
  BRIDGE_USAGE: {
    key: 'bridge',
    name: 'Direct Bridge Usage',
    regex: /\bwindow\.aynite\b/g,
    description:
      'Direct window.aynite access is only allowed in Page components (XXXPage.tsx) and renderer/src/ files. Use standardized context providers elsewhere.',
  },
  FORBIDDEN_GLOBALS: {
    key: 'globals',
    name: 'Forbidden Global Access',
    regex:
      /\bwindow\.(?!aynite|addEventListener|removeEventListener|localStorage|sessionStorage|location|open|close|focus|blur|print|scrollTo|scrollBy|innerWidth|innerHeight|outerWidth|outerHeight|devicePixelRatio|screen|requestAnimationFrame|cancelAnimationFrame|matchMedia|getComputedStyle|setTimeout|setInterval|clearTimeout|clearInterval|crypto|performance|history|document|navigator|top|parent|self|frames|ayniteConfig|dispatchEvent|removeEventListener|getSelection|getComputedStyle)\b[a-zA-Z0-9_]+/g,
    description:
      'Avoid accessing custom or internal window.xxx properties. Only window.aynite and standard Web APIs are allowed.',
  },
  TS_IGNORE: {
    key: 'ts-ignore',
    name: 'Stale @ts-ignore Comment',
    regex: /\/\/\s*@ts-ignore/g,
    description:
      'Avoid @ts-ignore comments. Declare proper types (e.g., add missing methods to the AyniteWindow interface) instead of suppressing type errors.',
  },
} satisfies Record<string, ViolationRule>

// Baseline counts — update these when intentionally reducing violations
const ANY_BASELINE = 113

// Help display
if (process.argv.includes('-h') || process.argv.includes('--help')) {
  console.log('\nAynite UI Architecture Auditor')
  console.log('Usage: npm run audit:ui -- [options]\n')
  console.log('Options:')
  console.log(
    '  --focus=[type]    Only run specific checks (import, types, strings, tags, styles, system, animation)',
  )
  console.log('  --folder=[path]   Audit a specific folder or file')
  console.log(
    '  --thorough        Run extra intensive checks (e.g. animation effects)',
  )
  console.log(
    '  --check           Exit with code 1 if any violation baseline is exceeded',
  )
  console.log('  -h, --help        Show this help message\n')
  console.log('Examples:')
  console.log('  npm run audit:ui -- --focus=import')
  console.log('  npm run audit:ui -- --folder=src/renderer/shared/basic\n')
  process.exit(0)
}

const focusArg = process.argv
  .find((arg) => arg.startsWith('--focus='))
  ?.split('=')[1]
const folderArg = process.argv
  .find((arg) => arg.startsWith('--folder='))
  ?.split('=')[1]
const thoroughArg = process.argv.includes('--thorough')
const checkArg = process.argv.includes('--check')

const activeViolations = focusArg
  ? Object.values(VIOLATIONS).filter(
      (v) => v.key === focusArg || v.name.toLowerCase().includes(focusArg),
    )
  : Object.values(VIOLATIONS).filter(
      (v) => thoroughArg || (v.key !== 'animation' && v.key !== 'bg-colors'),
    )

const targetFolders = folderArg
  ? [path.resolve(ROOT_DIR, folderArg)]
  : [SHARED_DIR, VIEWS_DIR, SRC_DIR]

const IGNORE_STRINGS = [
  'void',
  'any',
  'string',
  'number',
  'boolean',
  'Promise',
  'React',
  'null',
  'undefined',
  'px',
  'rem',
  'em',
  '%',
  'vh',
  'vw',
  'grid',
  'flex',
  'hidden',
  'block',
]

function walk(dir: string, callback: (f: string) => void) {
  if (!fs.existsSync(dir)) return

  const stats = fs.statSync(dir)
  if (!stats.isDirectory()) {
    if (dir.endsWith('.tsx') || dir.endsWith('.ts')) callback(dir)
    return
  }

  const files = fs.readdirSync(dir)
  files.forEach((file) => {
    const filepath = path.join(dir, file)
    const fStats = fs.statSync(filepath)
    if (fStats.isDirectory()) {
      if (file !== 'scripts' && file !== 'styles' && file !== 'node_modules') {
        walk(filepath, callback)
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filepath)
    }
  })
}

function isValidString(text: string) {
  if (text.length <= 2) return false
  if (/^[0-9\s.,!?:;()\-+*/=<>]+$/.test(text)) return false
  if (IGNORE_STRINGS.some((s) => text.includes(s))) return false
  if (text.includes('=>')) return false
  if (text.includes('{') || text.includes('}')) return false
  return true
}

const report: AuditIssue[] = []

const auditFile = (filepath: string) => {
  const relativePath = path.relative(ROOT_DIR, filepath)
  const content = fs.readFileSync(filepath, 'utf8')
  const lines = content.split('\n')

  // Determine category
  let category = ''
  if (filepath.includes(path.join(SHARED_DIR, 'lib'))) category = 'lib'
  else if (filepath.includes(path.join(SHARED_DIR, 'basic'))) category = 'basic'
  else if (filepath.includes(path.join(SHARED_DIR, 'featured', 'advanced')))
    category = 'advanced'
  else if (filepath.includes(path.join(SHARED_DIR, 'featured')))
    category = 'featured'
  else if (filepath.includes(path.join(SHARED_DIR, 'pages'))) category = 'pages'
  else if (filepath.includes(path.join(SHARED_DIR, 'context')))
    category = 'context'
  else if (filepath.includes(path.join(SRC_DIR, 'context')))
    category = 'src-context'
  else if (filepath.includes(path.join(SRC_DIR, 'components')))
    category = 'src-components'
  else if (filepath.includes(SRC_DIR)) category = 'src'
  else if (filepath.includes(path.join(VIEWS_DIR, 'context')))
    category = 'views-context'
  else if (filepath.includes(VIEWS_DIR)) category = 'views'

  // 1. Import Hierarchy Audit
  if (activeViolations.some((v) => v.key === 'import')) {
    const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      const lineNum = content.substring(0, match.index).split('\n').length

      if (importPath.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filepath), importPath)

        let targetCategory = ''
        if (resolvedPath.includes(path.join(SHARED_DIR, 'lib')))
          targetCategory = 'lib'
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'basic')))
          targetCategory = 'basic'
        else if (
          resolvedPath.includes(path.join(SHARED_DIR, 'featured', 'advanced'))
        )
          targetCategory = 'advanced'
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'featured')))
          targetCategory = 'featured'
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'pages')))
          targetCategory = 'pages'
        else if (resolvedPath.includes(path.join(SHARED_DIR, 'context')))
          targetCategory = 'context'
        else if (resolvedPath.includes(path.join(SRC_DIR, 'context')))
          targetCategory = 'src-context'
        else if (resolvedPath.includes(path.join(SRC_DIR, 'components')))
          targetCategory = 'src-components'
        else if (resolvedPath.includes(SRC_DIR)) targetCategory = 'src'
        else if (resolvedPath.includes(path.join(VIEWS_DIR, 'context')))
          targetCategory = 'views-context'
        else if (resolvedPath.includes(VIEWS_DIR)) targetCategory = 'views'

        let violation = false
        let msg = ''

        if (category === 'lib') {
          if (targetCategory !== 'lib' && targetCategory !== '') {
            violation = true
            msg =
              'lib module should only import from external packages or other lib files.'
          }
        } else if (category === 'basic') {
          const isException =
            filepath.endsWith('basic/Modal.tsx') ||
            filepath.endsWith('basic/Select.tsx')
          if (
            targetCategory !== 'lib' &&
            targetCategory !== 'context' &&
            !isException
          ) {
            violation = true
            msg = 'basic components should only import from lib or context.'
          }
        } else if (category === 'featured') {
          if (
            targetCategory !== 'basic' &&
            targetCategory !== 'lib' &&
            targetCategory !== 'context' &&
            targetCategory !== 'featured'
          ) {
            violation = true
            msg =
              'featured components should only import from basic, lib, context, or sibling featured components.'
          }
        } else if (category === 'advanced') {
          if (
            targetCategory !== 'featured' &&
            targetCategory !== 'basic' &&
            targetCategory !== 'lib' &&
            targetCategory !== 'context' &&
            targetCategory !== 'advanced'
          ) {
            violation = true
            msg =
              'advanced featured components should only import from featured, basic, lib, or context.'
          }
        } else if (category === 'pages') {
          if (targetCategory === 'pages') {
            const currentDir = path.dirname(filepath)
            const targetDir = path.dirname(resolvedPath)
            if (currentDir !== targetDir) {
              violation = true
              msg =
                'Pages should not import from other page directories. Consider refactoring shared logic to featured/basic.'
            }
          } else if (targetCategory === 'views') {
            violation = true
            msg = 'Shared pages should not import from views.'
          }
        } else if (category === 'src-components') {
          if (
            targetCategory === 'src' ||
            targetCategory === 'src-context' ||
            targetCategory === 'views' ||
            targetCategory === 'views-context'
          ) {
            violation = true
            msg =
              'src/components can only import from shared (lib, basic, featured, etc.).'
          }
        } else if (category === 'views' || category === 'views-context') {
          if (targetCategory.startsWith('src')) {
            violation = true
            msg =
              'Views should not import from renderer/src. Views are standalone micro-apps.'
          }
        }

        if (violation) {
          report.push({
            type: VIOLATIONS.IMPORT_HIERARCHY.name,
            file: relativePath,
            line: lineNum,
            snippet: lines[lineNum - 1].trim(),
            message: msg,
          })
        }
      }
    }
  }

  // 2. Strict Typing
  if (activeViolations.some((v) => v.key === 'types')) {
    // Audit for 'any'
    let anyMatch
    while (
      (anyMatch = VIOLATIONS.STRICT_TYPING.anyRegex.exec(content)) !== null
    ) {
      const lineNum = content.substring(0, anyMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.STRICT_TYPING.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: 'Detected usage of "any". Use more specific types.',
      })
    }
  }

  // 3. System Calls
  if (activeViolations.some((v) => v.key === 'system')) {
    let sysMatch
    while ((sysMatch = VIOLATIONS.SYSTEM_CALLS.regex.exec(content)) !== null) {
      const lineNum = content.substring(0, sysMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.SYSTEM_CALLS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.SYSTEM_CALLS.description,
      })
    }
  }

  // 4. Component Duplication
  if (
    activeViolations.some((v) => v.key === 'tags') &&
    category !== 'basic' &&
    category !== 'lib'
  ) {
    VIOLATIONS.COMPONENT_DUPLICATION.tags.forEach((tag) => {
      const tagRegex = new RegExp(`<${tag}[\\s>]`, 'g')
      let tagMatch
      while ((tagMatch = tagRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, tagMatch.index).split('\n').length
        report.push({
          type: VIOLATIONS.COMPONENT_DUPLICATION.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Found <${tag}>. ${VIOLATIONS.COMPONENT_DUPLICATION.description}`,
        })
      }
    })

    // Merge: Detect manual dropdown/menu overlays
    const isOverlay =
      /\b(absolute|fixed)\b/.test(content) &&
      /\b(bg-sidebar|bg-background|shadow-2xl)\b/.test(content)
    const buttonCount = (content.match(/<button/g) || []).length

    if (isOverlay && buttonCount > 2) {
      const overlayMatch = content.match(
        /<(?:div|section)[^>]*\b(absolute|fixed)\b[^>]*>/,
      )
      if (overlayMatch) {
        const lineNum = content
          .substring(0, overlayMatch.index)
          .split('\n').length
        report.push({
          type: VIOLATIONS.COMPONENT_DUPLICATION.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Detected manual overlay with ${buttonCount} buttons. ${VIOLATIONS.COMPONENT_DUPLICATION.description}`,
        })
      }
    }
  }

  // 5. Adaptive Styles
  if (activeViolations.some((v) => v.key === 'styles')) {
    let adaptMatch
    while (
      (adaptMatch = VIOLATIONS.ADAPTIVE_STYLES.regex.exec(content)) !== null
    ) {
      const lineNum = content.substring(0, adaptMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.ADAPTIVE_STYLES.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.ADAPTIVE_STYLES.description,
      })
    }
  }

  // 6. Hardcoded Strings
  if (activeViolations.some((v) => v.key === 'strings')) {
    let textMatch
    while (
      (textMatch =
        VIOLATIONS.HARDCODED_STRINGS.textNodeRegex?.exec(content)) !== null
    ) {
      const text = textMatch[1].trim()
      if (isValidString(text)) {
        const lineNum = content.substring(0, textMatch.index).split('\n').length
        report.push({
          type: VIOLATIONS.HARDCODED_STRINGS.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Potential hardcoded text node: "${text}"`,
        })
      }
    }

    let propMatch
    while (
      (propMatch = VIOLATIONS.HARDCODED_STRINGS.propRegex?.exec(content)) !==
      null
    ) {
      const propName = propMatch[1]
      const text = propMatch[2].trim()
      if (isValidString(text)) {
        const lineNum = content.substring(0, propMatch.index).split('\n').length
        report.push({
          type: VIOLATIONS.HARDCODED_STRINGS.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Potential hardcoded prop ${propName}: "${text}"`,
        })
      }
    }
  }

  // 7. Direct Path Module Import
  if (
    activeViolations.some((v) => v.key === 'path-import') &&
    !filepath.endsWith('src/lib/path.ts')
  ) {
    let pathMatch
    while (
      (pathMatch = VIOLATIONS.DIRECT_PATH_IMPORT.regex.exec(content)) !== null
    ) {
      const lineNum = content.substring(0, pathMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.DIRECT_PATH_IMPORT.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.DIRECT_PATH_IMPORT.description,
      })
    }
  }

  // 8. Forbidden Path Functions
  if (
    activeViolations.some((v) => v.key === 'path-func') &&
    !filepath.endsWith('src/lib/path.ts')
  ) {
    let pathMatch
    while (
      (pathMatch = VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.regex.exec(content)) !==
      null
    ) {
      const lineNum = content.substring(0, pathMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.description,
      })
    }
  }

  // 9. Z-Index Hierarchy
  if (activeViolations.some((v) => v.key === 'z-index')) {
    let zMatch
    while (
      (zMatch = VIOLATIONS.Z_INDEX_HIERARCHY.regex?.exec(content)) !== null
    ) {
      const value = parseInt(zMatch[1] || zMatch[2], 10)
      const allowedValues = [
        0, 1, 10, 50, 100, 1000, 2000, 3000, 4000, 5000, 6000,
      ]

      if (!allowedValues.includes(value)) {
        const lineNum = content.substring(0, zMatch.index).split('\n').length
        report.push({
          type: VIOLATIONS.Z_INDEX_HIERARCHY.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: `Detected non-standard z-index value: ${value}. ${VIOLATIONS.Z_INDEX_HIERARCHY.description}`,
        })
      }
    }
  }

  // 10. Animation Effects (Thorough)
  if (activeViolations.some((v) => v.key === 'animation')) {
    let animMatch
    while (
      (animMatch = VIOLATIONS.ANIMATION_EFFECTS.regex?.exec(content)) !== null
    ) {
      const lineNum = content.substring(0, animMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.ANIMATION_EFFECTS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.ANIMATION_EFFECTS.description,
      })
    }
  }
  // 11. Background Colors (Thorough & Views specific)
  if (
    activeViolations.some((v) => v.key === 'bg-colors') &&
    category === 'views'
  ) {
    let bgMatch
    while (
      (bgMatch = VIOLATIONS.BACKGROUND_COLORS.regex?.exec(content)) !== null
    ) {
      const lineNum = content.substring(0, bgMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.BACKGROUND_COLORS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.BACKGROUND_COLORS.description,
      })
    }
  }

  // 12. Legacy Messaging (Thorough)
  if (activeViolations.some((v) => v.key === 'messaging')) {
    let msgMatch
    while (
      (msgMatch = VIOLATIONS.LEGACY_MESSAGING.regex?.exec(content)) !== null
    ) {
      const lineNum = content.substring(0, msgMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.LEGACY_MESSAGING.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.LEGACY_MESSAGING.description,
      })
    }
  }

  // 13. Bridge Usage
  if (activeViolations.some((v) => v.key === 'bridge')) {
    const isAllowedFile =
      filepath.endsWith('AIChat.tsx') ||
      filepath.endsWith('Treeview.tsx') ||
      filepath.endsWith('Settings.tsx') ||
      filepath.endsWith('FileBrowserPage.tsx') ||
      filepath.includes('useTheme.ts') ||
      filepath.includes('src/renderer/src/')
    if (!isAllowedFile) {
      let bridgeMatch
      while (
        (bridgeMatch = VIOLATIONS.BRIDGE_USAGE.regex?.exec(content)) !== null
      ) {
        const lineNum = content
          .substring(0, bridgeMatch.index)
          .split('\n').length
        report.push({
          type: VIOLATIONS.BRIDGE_USAGE.name,
          file: relativePath,
          line: lineNum,
          snippet: lines[lineNum - 1].trim(),
          message: VIOLATIONS.BRIDGE_USAGE.description,
        })
      }
    }
  }

  // 14. Forbidden Globals
  if (activeViolations.some((v) => v.key === 'globals')) {
    let globalMatch
    while (
      (globalMatch = VIOLATIONS.FORBIDDEN_GLOBALS.regex?.exec(content)) !== null
    ) {
      const lineNum = content.substring(0, globalMatch.index).split('\n').length
      report.push({
        type: VIOLATIONS.FORBIDDEN_GLOBALS.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.FORBIDDEN_GLOBALS.description,
      })
    }
  }

  // 16. Stale @ts-expect-error Comments
  if (activeViolations.some((v) => v.key === 'ts-ignore')) {
    let tsIgnoreMatch
    while (
      (tsIgnoreMatch = VIOLATIONS.TS_IGNORE.regex?.exec(content)) !== null
    ) {
      const lineNum = content
        .substring(0, tsIgnoreMatch.index)
        .split('\n').length
      report.push({
        type: VIOLATIONS.TS_IGNORE.name,
        file: relativePath,
        line: lineNum,
        snippet: lines[lineNum - 1].trim(),
        message: VIOLATIONS.TS_IGNORE.description,
      })
    }
  }
}

for (const folder of targetFolders) {
  walk(folder, auditFile)
}

const grouped: Record<string, AuditIssue[]> = report.reduce(
  (acc: Record<string, AuditIssue[]>, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item)
    return acc
  },
  {},
)

const DISPLAY_ORDER = [
  VIOLATIONS.IMPORT_HIERARCHY.name,
  VIOLATIONS.STRICT_TYPING.name,
  VIOLATIONS.HARDCODED_STRINGS.name,
  VIOLATIONS.COMPONENT_DUPLICATION.name,
  VIOLATIONS.ADAPTIVE_STYLES.name,
  VIOLATIONS.SYSTEM_CALLS.name,
  VIOLATIONS.DIRECT_PATH_IMPORT.name,
  VIOLATIONS.FORBIDDEN_PATH_FUNCTIONS.name,
  VIOLATIONS.Z_INDEX_HIERARCHY.name,
  VIOLATIONS.ANIMATION_EFFECTS.name,
  VIOLATIONS.BACKGROUND_COLORS.name,
  VIOLATIONS.LEGACY_MESSAGING.name,
  VIOLATIONS.BRIDGE_USAGE.name,
  VIOLATIONS.FORBIDDEN_GLOBALS.name,
  VIOLATIONS.TS_IGNORE.name,
]

console.log('\n=================================================')
console.log('   Aynite Shared & Views Architecture Audit')
if (focusArg) {
  console.log(`   FOCUS: ${activeViolations.map((v) => v.name).join(', ')}`)
}
if (folderArg) {
  console.log(`   FOLDER: ${folderArg}`)
}
console.log('=================================================\n')

if (report.length === 0) {
  console.log('✅ EXCELLENT: No architectural violations found!\n')
} else {
  DISPLAY_ORDER.forEach((typeName) => {
    const items = grouped[typeName] || []
    if (items.length === 0) return

    const badge =
      typeName === VIOLATIONS.IMPORT_HIERARCHY.name
        ? '🚨 ARCHITECTURE'
        : typeName === VIOLATIONS.STRICT_TYPING.name
          ? '🚨 TYPING'
          : typeName === VIOLATIONS.SYSTEM_CALLS.name
            ? '🚨 CRITICAL'
            : typeName === VIOLATIONS.BRIDGE_USAGE.name
              ? '🚨 CRITICAL'
              : typeName === VIOLATIONS.FORBIDDEN_GLOBALS.name
                ? '🚨 CRITICAL'
                : typeName === VIOLATIONS.ADAPTIVE_STYLES.name
                  ? '⚠️ WARNING'
                  : typeName === VIOLATIONS.COMPONENT_DUPLICATION.name
                    ? '⚠️ WARNING'
                    : '📝 NOTICE'

    console.log(`>>> ${badge}: ${typeName} (${items.length} issues) <<<`)
    console.log('-'.repeat(typeName.length + 25))

    items.forEach((item) => {
      console.log(`[${item.file}:${item.line}] ${item.snippet}`)
      console.log(`   └─ ${item.message}\n`)
    })
  })

  console.log('=================================================')
  console.log(`TOTAL POTENTIAL ISSUES: ${report.length}`)
  DISPLAY_ORDER.forEach((typeName) => {
    if (focusArg && !activeViolations.some((v) => v.name === typeName)) return

    const count = grouped[typeName]?.length || 0
    const status =
      count > 0
        ? typeName === VIOLATIONS.IMPORT_HIERARCHY.name ||
          typeName === VIOLATIONS.STRICT_TYPING.name ||
          typeName === VIOLATIONS.SYSTEM_CALLS.name
          ? '🔴 FIX REQUIRED'
          : '🟡 REFAC OR REVIEW'
        : '🟢 CLEAN'
    console.log(` - ${typeName}: ${count} [${status}]`)
  })
}
console.log('\n=== End of Report ===\n')

// Baseline check — fail CI if typing violations exceed baseline
if (checkArg) {
  const typingCount = grouped[VIOLATIONS.STRICT_TYPING.name]?.length || 0
  if (typingCount > ANY_BASELINE) {
    console.error(
      `❌ TYPING REGRESSION: Strict Typing violations (${typingCount}) exceed baseline (${ANY_BASELINE}).`,
    )
    process.exit(1)
  } else {
    console.log(
      `✅ TYPING OK: Strict Typing violations (${typingCount}) at or below baseline (${ANY_BASELINE}).`,
    )
  }
}
