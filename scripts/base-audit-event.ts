import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const RENDERER_SRC = path.join(ROOT, 'src/renderer/src')
const RENDERER_SHARED = path.join(ROOT, 'src/renderer/shared')
const RENDERER_VIEWS = path.join(ROOT, 'src/renderer/views')

const HUB_FILE = 'src/renderer/src/AppContext.tsx'
const SPOKE_FILE = 'src/renderer/views/ViewContext.tsx'

interface Violation {
  file: string
  line: number
  message: string
}

const violations: Violation[] = []

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const relativePath = path.relative(ROOT, filePath)

  lines.forEach((line, index) => {
    const lineNum = index + 1

    // 1. Direct IPC Audit
    if (relativePath !== HUB_FILE && !filePath.endsWith('.d.ts')) {
      if (line.includes('onAppEvent') || line.includes('onAppOperation')) {
        violations.push({
          file: relativePath,
          line: lineNum,
          message: `Direct IPC access (onAppEvent/onAppOperation) found outside of HUB (${HUB_FILE}).`,
        })
      }
    }

    // 2. Manual Message Listener Audit (Views and Shared components should use useAppEvent)
    if (
      (relativePath.startsWith('src/renderer/views') || relativePath.startsWith('src/renderer/shared')) &&
      relativePath !== SPOKE_FILE && !filePath.endsWith('.d.ts')
    ) {
      if (line.includes("addEventListener('message'") || line.includes('window.onmessage')) {
         violations.push({
          file: relativePath,
          line: lineNum,
          message: `Manual message listener found in View/Shared component. MUST use useAppEvent from ${SPOKE_FILE}.`,
        })
      }
    }
    
    // 3. Manual Event Parsing Audit
    if (line.includes('aynite:') && relativePath !== HUB_FILE && relativePath !== SPOKE_FILE && !filePath.endsWith('.d.ts')) {
       violations.push({
          file: relativePath,
          line: lineNum,
          message: `Manual 'aynite:' event prefix parsing found. Use standardized hooks instead.`,
        })
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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      scanFile(fullPath)
    }
  })
}

// --- Run Audit ---

console.log('--- Starting Hub-and-Spoke Architectural Audit ---')

// 1. Verify Hub exists and contains Relay logic
if (!fs.existsSync(path.join(ROOT, HUB_FILE))) {
  console.error(`ERROR: Hub file not found at ${HUB_FILE}`)
  process.exit(1)
}
const hubContent = fs.readFileSync(path.join(ROOT, HUB_FILE), 'utf8')
if (!hubContent.includes('postMessage') || !hubContent.includes('iframe')) {
  violations.push({
    file: HUB_FILE,
    line: 0,
    message: 'Hub file is missing event relay logic (postMessage to iframes).',
  })
}

// 2. Scan all renderer directories
scanDir(RENDERER_SRC)
scanDir(RENDERER_SHARED)
scanDir(RENDERER_VIEWS)

// --- Report ---

if (violations.length === 0) {
  console.log('✅ Audit Passed: No Hub-and-Spoke violations found.')
  process.exit(0)
} else {
  console.error(`❌ Audit Failed: Found ${violations.length} violations.\n`)
  violations.forEach((v) => {
    console.error(`[${v.file}:${v.line}] ${v.message}`)
  })
  process.exit(1)
}
