import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, SRC_DIR, report, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const violations: any[] = []

// Regex for raw HTML tags
const RAW_TAG_REGEX = /<(button|input|select|textarea)([\s\/>]|$)/g
// Regex for native browser alerts
const NATIVE_ALERT_REGEX = /\b(alert|confirm)\s*\(/g
// Regex for system message box (electron dialog)
const SYSTEM_DIALOG_REGEX = /\b(showMessageBox|showErrorBox)\b/g

walk(SRC_DIR, (filePath) => {
  const relativePath = path.relative(ROOT_DIR, filePath)
  const isMainProcess = relativePath.startsWith('src/main') || relativePath.startsWith('src/preload')
  
  // 1. Skip shared/basic as it IS allowed to use raw tags to build primitives
  if (relativePath.includes('shared/basic')) return

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) return

    // Check for raw tags in renderer
    if (!isMainProcess) {
      let match: RegExpExecArray | null
      // Reset regex state since we use global flag
      RAW_TAG_REGEX.lastIndex = 0
      while ((match = RAW_TAG_REGEX.exec(line)) !== null) {
        const tag = match[1]
        violations.push({
          file: relativePath,
          line: index + 1,
          snippet: line.trim(),
          message: `Raw HTML tag <${tag}> found. Use shared/basic components instead.`,
        })
      }
    }

    // Check for alerts
    let alertMatch: RegExpExecArray | null
    NATIVE_ALERT_REGEX.lastIndex = 0
    while ((alertMatch = NATIVE_ALERT_REGEX.exec(line)) !== null) {
      const func = alertMatch[1]
      violations.push({
        file: relativePath,
        line: index + 1,
        snippet: line.trim(),
        message: `Native ${func}() call found. Use showToast or shared/basic/Modal instead.`,
      })
    }

    // Check for system dialogs (should only be in window.ts or handled correctly)
    // Actually we want to discourage them project-wide if possible
    let dialogMatch: RegExpExecArray | null
    SYSTEM_DIALOG_REGEX.lastIndex = 0
    while ((dialogMatch = SYSTEM_DIALOG_REGEX.exec(line)) !== null) {
      const func = dialogMatch[1]
      // Whitelist window.ts as it might need it for system-level errors (though we prefer not)
      if (relativePath.includes('window.ts')) return

      violations.push({
        file: relativePath,
        line: index + 1,
        snippet: line.trim(),
        message: `System dialog ${func} found. Use UI-based notifications instead.`,
      })
    }
    
    // Suggestion for postMessage
    if (line.includes('postMessage') && relativePath.includes('renderer/views')) {
        violations.push({
            file: relativePath,
            line: index + 1,
            snippet: line.trim(),
            message: 'postMessage found in view. Use aynite bridge directly instead.',
        })
    }
  })
})

report('Aynite Component Architectural Audit', violations, checkMode)
