import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const MAIN_DIR = 'src/main'
const WINDOW_FILE = 'window.ts'

const VIOLATIONS: string[] = []

function checkFile(filePath: string) {
  const content = readFileSync(filePath, 'utf-8')
  const fileName = basename(filePath)

  if (fileName === WINDOW_FILE) return

  // 1. Check for direct BrowserWindow usage
  if (
    content.includes('new BrowserWindow') ||
    content.includes('import { BrowserWindow }')
  ) {
    VIOLATIONS.push(
      `[${filePath}] Illegal usage/import of BrowserWindow. Only ${WINDOW_FILE} can manage windows.`,
    )
  }

  // 2. Check for webContents usage
  if (content.includes('.webContents')) {
    VIOLATIONS.push(
      `[${filePath}] Illegal usage of .webContents. Use helpers in ${WINDOW_FILE} instead.`,
    )
  }

  // 3. Check for illegal listeners (strictly no ipcMain.on)
  if (content.includes('ipcMain.on')) {
    VIOLATIONS.push(
      `[${filePath}] Illegal usage of ipcMain.on. Use ipcMain.handle for service-oriented patterns.`,
    )
  }

  // 4. Check for other potential illegal listeners (.on)
  const onMatches = content.match(/\.on\(['"][\w-]+['"]/g)
  if (onMatches) {
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (
        line.includes('.on(') &&
        !line.includes('app.on') &&
        !line.includes('process.on') &&
        !line.includes('watcher.on') &&
        !line.includes('emitter.on') && // Allow generic internal emitters if they exist, but audit carefully
        !line.includes('ipcMain.on') // Already handled above
      ) {
        // Narrow check for Electron-specific event emitters
        if (line.includes('window.on') || line.includes('updater.on')) {
          VIOLATIONS.push(
            `[${filePath}:${i + 1}] Illegal Electron listener registration (.on). Use ${WINDOW_FILE} helpers.`,
          )
        }
      }
    }
  }

  // 5. Ensure window internals aren't exported
  if (
    content.includes('export function getMainWindow') ||
    content.includes('export const getMainWindow')
  ) {
    VIOLATIONS.push(`[${filePath}] getMainWindow must NOT be exported.`)
  }
}

function walk(dir: string) {
  const files = readdirSync(dir)
  for (const file of files) {
    const fullPath = join(dir, file)
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath)
    } else if (file.endsWith('.ts')) {
      checkFile(fullPath)
    }
  }
}

console.log('--- Starting Window Architecture Audit ---')
walk(MAIN_DIR)

if (VIOLATIONS.length === 0) {
  console.log('✅ Audit passed! All window management is centralized.')
} else {
  console.error('❌ Audit failed! Found the following violations:')
  for (const v of VIOLATIONS) {
    console.error(v)
  }
  process.exit(1)
}
