import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()
const RENDERER_ROOT = path.join(ROOT, 'src/renderer')

interface Violation {
  file: string
  line: number
  message: string
  suggestion?: string
}

const violations: Violation[] = []

function scanFile(filePath: string) {
  // Regex for raw HTML tags
  const RAW_TAG_REGEX = /<(button|input|select|textarea)([\s\/>]|$)/g
  // Regex for native browser alerts
  const NATIVE_ALERT_REGEX = /\b(alert|confirm)\s*\(/g
  // Regex for system message box (electron dialog)
  const SYSTEM_DIALOG_REGEX = /\b(showMessageBox|showErrorBox|showOpenDialog|showSaveDialog)\b/g

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const relativePath = path.relative(ROOT, filePath)
  
  // 1. Skip shared/basic as it IS allowed to use raw tags to build primitives
  if (relativePath.includes('shared/basic')) return
  
  // 2. Skip preload as it doesn't render UI
  if (relativePath.includes('src/preload')) return

  // 3. Skip main process for raw tags, but check for system dialogs there if they are being forbidden for common use
  const isMainProcess = relativePath.startsWith('src/main')
  
  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) return

    // Check for raw tags in renderer
    if (!isMainProcess) {
      let match
      while ((match = RAW_TAG_REGEX.exec(line)) !== null) {
        violations.push({
          file: relativePath,
          line: lineNum,
          message: `Raw HTML tag <${match[1]}> found.`,
          suggestion: `Use the standardized component from shared/basic/${match[1].charAt(0).toUpperCase() + match[1].slice(1)} instead.`
        })
      }
    }

    // Check for native alerts (renderer only)
    if (!isMainProcess) {
      let alertMatch
      while ((alertMatch = NATIVE_ALERT_REGEX.exec(line)) !== null) {
        violations.push({
          file: relativePath,
          line: lineNum,
          message: `Native browser function ${alertMatch[1]}() found.`,
          suggestion: 'Use a shared Modal or Toast component for user notifications.'
        })
      }
    }

    // Check for system dialogs in Main process (except in src/main/window.ts where they are centralized)
    if (isMainProcess && relativePath !== 'src/main/window.ts') {
      let dialogMatch
      while ((dialogMatch = SYSTEM_DIALOG_REGEX.exec(line)) !== null) {
        // Allow showOpenDialog and showSaveDialog if they are being used in a controlled way, 
        // but the user specifically mentioned "you cannot use system alert" (showMessageBox).
        if (dialogMatch[1] === 'showMessageBox' || dialogMatch[1] === 'showErrorBox') {
          violations.push({
            file: relativePath,
            line: lineNum,
            message: `System dialog ${dialogMatch[1]} found in non-window module.`,
            suggestion: 'System alerts are forbidden. Relay errors to the renderer to show a shared UI component.'
          })
        }
      }
    }
  })
}

function scanDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) return
  const files = fs.readdirSync(dirPath)
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      scanDir(fullPath)
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      scanFile(fullPath)
    }
  })
}

// --- Run Audit ---

console.log('--- Starting Component Architectural Audit ---')

// Scan renderer and main (with logic exceptions)
scanDir(path.join(ROOT, 'src/renderer'))
scanDir(path.join(ROOT, 'src/main'))

// --- Report ---

if (violations.length === 0) {
  console.log('✅ Audit Passed: Component usage is compliant.')
  process.exit(0)
} else {
  console.error(`❌ Audit Failed: Found ${violations.length} component violations.\n`)
  violations.forEach((v) => {
    console.error(`[${v.file}:${v.line}] ${v.message}`)
    if (v.suggestion) {
      console.error(`    💡 Suggestion: ${v.suggestion}`)
    }
  })
  process.exit(1)
}
