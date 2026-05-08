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
  suggestion?: string
}

const violations: Violation[] = []

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const relativePath = path.relative(ROOT, filePath)
  const isHub = relativePath === HUB_FILE
  const isSpoke = relativePath === SPOKE_FILE

  let inOnAppEvent = false

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()

    // 1. Direct IPC Listener Audit
    if (!isHub && !filePath.endsWith('.d.ts')) {
      if (line.includes('onAppEvent') || line.includes('onAppOperation')) {
        violations.push({
          file: relativePath,
          line: lineNum,
          message: `Direct IPC listener (onAppEvent/onAppOperation) found outside of HUB (${HUB_FILE}).`,
          suggestion: 'Listeners must be handled by the AppContext Hub and relayed to iframes.',
        })
      }
    }

    // 2. Relay & postMessage Audit
    if (line.includes('postMessage')) {
      // Rule: Only the Hub can postMessage, and only inside onAppEvent
      if (isHub) {
        if (line.includes('onAppEvent')) inOnAppEvent = true
        // Basic check for block context (heuristic)
        if (!line.includes('postMessage(')) return 
        
        // If we see postMessage but we aren't sure we are in onAppEvent, we'd need a real parser, 
        // but for now let's flag if it looks like a handshake
        if (line.includes('aynite:init-view') || line.includes('handshake')) {
             violations.push({
              file: relativePath,
              line: lineNum,
              message: 'Hub is attempting an ad-hoc handshake protocol.',
              suggestion: 'Use direct IPC for view initialization; only use relay for system broadcasts.',
            })
        }
      } else if (!isSpoke) {
        // Any other component calling postMessage
        violations.push({
          file: relativePath,
          line: lineNum,
          message: `Manual postMessage found outside of Hub/Spoke infrastructure.`,
          suggestion: 'Use window.aynite directly for data fetching/operations, or useAppEvent for system broadcasts.',
        })
      }
    }

    // 3. Manual Message Listener Audit
    if ((relativePath.startsWith('src/renderer/views') || relativePath.startsWith('src/renderer/shared')) && !isSpoke && !filePath.endsWith('.d.ts')) {
      if (line.includes("addEventListener('message'") || line.includes('window.onmessage')) {
         violations.push({
          file: relativePath,
          line: lineNum,
          message: `Manual message listener found.`,
          suggestion: `Views MUST use useAppEvent from ${SPOKE_FILE} to stay synchronized with the Hub.`,
        })
      }
    }
    
    // 4. Manual Event Prefix / Arbitrary Event Audit
    if (line.includes('aynite:') && !isHub && !isSpoke && !filePath.endsWith('.d.ts')) {
       // Check if it's a hardcoded string
       if (line.includes("'aynite:") || line.includes('"aynite:')) {
         violations.push({
            file: relativePath,
            line: lineNum,
            message: `Hardcoded 'aynite:' event string found.`,
            suggestion: `Use the AppEvents constants and the useAppEvent hook.`,
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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      scanFile(fullPath)
    }
  })
}

// --- Run Audit ---

console.log('--- Starting Hub-and-Spoke Architectural Audit (STRICT MODE) ---')

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
  console.log('✅ Audit Passed: Hub-and-Spoke integrity verified.')
  process.exit(0)
} else {
  console.error(`❌ Audit Failed: Found ${violations.length} architectural violations.\n`)
  violations.forEach((v) => {
    console.error(`[${v.file}:${v.line}] ${v.message}`)
    if (v.suggestion) {
      console.error(`    💡 Suggestion: ${v.suggestion}`)
    }
  })
  process.exit(1)
}
