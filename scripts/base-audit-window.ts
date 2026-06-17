import fs from 'node:fs'
import path from 'node:path'
import { ROOT_DIR, report, walk } from './audit-utils'

const checkMode = process.argv.includes('--check')
const MAIN_DIR = path.join(ROOT_DIR, 'src/main')
const WINDOW_FILE = 'window.ts'
const IPC_UTILS_FILE = 'ipc-utils.ts'
const APPROVAL_QUEUE_FILE = 'approval-queue.ts'
const violations: any[] = []

walk(MAIN_DIR, (fullPath) => {
  const relPath = path.relative(ROOT_DIR, fullPath)
  const fileName = path.basename(fullPath)
  const content = fs.readFileSync(fullPath, 'utf-8')

  // Skip the whitelisted window-management files
  if (fileName === WINDOW_FILE) return
  if (fileName === IPC_UTILS_FILE) return
  if (fileName === APPROVAL_QUEUE_FILE) return

  // 1. Check for direct BrowserWindow usage
  if (
    content.includes('new BrowserWindow') ||
    content.includes('import { BrowserWindow }')
  ) {
    violations.push({
      file: relPath,
      message: `Illegal usage/import of BrowserWindow. Only ${WINDOW_FILE} can manage windows.`,
      snippet: 'BrowserWindow usage detected',
    })
  }

  // 2. Check for webContents usage
  if (content.includes('.webContents')) {
    violations.push({
      file: relPath,
      message: `Illegal usage of .webContents. Use helpers in ${WINDOW_FILE} instead.`,
      snippet: '.webContents usage detected',
    })
  }

  // 3. Check for illegal listeners (strictly no ipcMain.on)
  if (content.includes('ipcMain.on')) {
    violations.push({
      file: relPath,
      message: `Illegal usage of ipcMain.on. Use ipcMain.handle for service-oriented patterns.`,
      snippet: 'ipcMain.on detected',
    })
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
        !line.includes('emitter.on') &&
        !line.includes('ipcMain.on')
      ) {
        if (line.includes('window.on') || line.includes('updater.on')) {
          violations.push({
            file: relPath,
            line: i + 1,
            snippet: line.trim(),
            message: `Illegal Electron listener registration (.on). Use ${WINDOW_FILE} helpers.`,
          })
        }
      }
    }
  }

  // 5. Ensure window internals aren't exported
  if (
    content.includes('export function getMainWindow') ||
    content.includes('export const getMainWindow')
  ) {
    violations.push({
      file: relPath,
      message: 'getMainWindow must NOT be exported.',
      snippet: 'export getMainWindow detected',
    })
  }
})

report('Aynite Window Architecture Audit', violations, checkMode)
