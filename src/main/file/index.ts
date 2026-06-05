import { watch as fsWatch } from 'node:fs'
import { ipcMain } from 'electron'
import { AppEvents as AppEventTypes } from '../../lib/constants/app'
import { FileChannels } from '../../lib/constants/ipc-channels'
import {
  checkIsTextFile,
  copy,
  ensureDir,
  expandHome,
  getAbsolutePath,
  getBasename,
  getExtname,
  joinPaths,
  readBinary,
  readdir,
  readText,
  remove,
  rename,
  stat,
  writeText,
} from '../../lib/path'
import { getIgnorePatterns } from '../config'
import { gitService } from '../git/index'
import { trackEvent } from '../telemetry/index'
import { broadcastAppEvent, getWinIdFromSender, sendToWindow } from '../window'
import { onWindowClose } from '../window-state'

// Per-window active file watchers: windowId → { path, watcher }
const activeFileWatchers = new Map<
  number,
  { path: string; watcher: ReturnType<typeof fsWatch> }
>()

// ─── Payload types ─────────────────────────────────────────────────────────
interface FileCreatePayload {
  path: string
  isDirectory: boolean
}

interface FileRenamePayload {
  oldPath: string
  newPath: string
}

interface FileCopyPayload {
  srcPath: string
  destPath: string
}

interface FileSavePayload {
  path: string
  content: string
}

export function setupFileIpc() {
  ipcMain.handle(FileChannels.LIST, async (_event, dirPath: string = '.') => {
    try {
      const resolvedPath = getAbsolutePath(expandHome(dirPath))
      const files = await readdir(resolvedPath)

      let ignorePatterns: string[] = []
      try {
        ignorePatterns = await getIgnorePatterns()
      } catch (e) {
        console.error('Failed to get ignore patterns', e)
      }

      const result = files
        .filter(
          (file) =>
            !Array.isArray(ignorePatterns) ||
            !ignorePatterns.includes(file.name),
        )
        .map((file) => ({
          name: file.name,
          isDirectory: file.isDirectory(),
          path: joinPaths(resolvedPath, file.name),
        }))

      result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
      return result
    } catch (error: unknown) {
      console.error('aynite:file-list error:', error)
      throw error
    }
  })

  ipcMain.handle(FileChannels.READ, async (_event, filePath: string) => {
    return await readText(filePath)
  })

  ipcMain.handle(FileChannels.READ_BINARY, async (_event, filePath: string) => {
    return await readBinary(filePath)
  })

  ipcMain.handle(FileChannels.CHECK_TEXT, async (_event, filePath: string) => {
    return await checkIsTextFile(expandHome(filePath))
  })

  ipcMain.handle(FileChannels.INFO, async (_event, filePath: string) => {
    const expandedPath = expandHome(filePath)
    const s = await stat(expandedPath)
    const isText = s.isDirectory() ? false : await checkIsTextFile(expandedPath)

    return {
      name: getBasename(expandedPath),
      size: s.size,
      createdAt: s.birthtime,
      modifiedAt: s.mtime,
      isDirectory: s.isDirectory(),
      path: expandedPath,
      extension: getExtname(expandedPath).toLowerCase().slice(1),
      isText,
    }
  })

  ipcMain.handle(
    FileChannels.CREATE,
    async (_event, { path: filePath, isDirectory }: FileCreatePayload) => {
      if (isDirectory) {
        await ensureDir(filePath)
      } else {
        await writeText(filePath, '')
      }
      trackEvent('file_created', { is_directory: isDirectory })
      // Notify all windows so treeview/file-browser can refresh
      broadcastAppEvent(AppEventTypes.FS_CHANGE, {
        event: 'add',
        path: filePath,
      })
      gitService.handleFsChange(filePath)
      return true
    },
  )

  ipcMain.handle(
    FileChannels.RENAME,
    async (_event, { oldPath, newPath }: FileRenamePayload) => {
      await rename(oldPath, newPath)
      trackEvent('file_renamed')
      broadcastAppEvent(AppEventTypes.FILE_RENAMED, { oldPath, newPath })
      broadcastAppEvent(AppEventTypes.FS_CHANGE, {
        event: 'rename',
        path: newPath,
      })
      gitService.handleFsChange(newPath)
      return true
    },
  )

  ipcMain.handle(
    FileChannels.COPY,
    async (_event, { srcPath, destPath }: FileCopyPayload) => {
      await copy(srcPath, destPath, { recursive: true })
      trackEvent('file_copied')
      broadcastAppEvent(AppEventTypes.FS_CHANGE, {
        event: 'add',
        path: destPath,
      })
      gitService.handleFsChange(destPath)
      return true
    },
  )

  ipcMain.handle(FileChannels.DELETE, async (_event, filePath: string) => {
    await remove(filePath, { recursive: true, force: true })
    trackEvent('file_deleted')
    broadcastAppEvent(AppEventTypes.FILE_DELETED, { path: filePath })
    broadcastAppEvent(AppEventTypes.FS_CHANGE, {
      event: 'unlink',
      path: filePath,
    })
    gitService.handleFsChange(filePath)
    return true
  })

  ipcMain.handle(
    FileChannels.SAVE,
    async (_event, { path: filePath, content }: FileSavePayload) => {
      await writeText(filePath, content)
      trackEvent('file_saved', {
        extension: getExtname(filePath).toLowerCase().slice(1) || 'none',
      })
      broadcastAppEvent(AppEventTypes.FS_CHANGE, {
        event: 'change',
        path: filePath,
      })
      gitService.handleFsChange(filePath)
      return true
    },
  )

  /**
   * Watch a file for external changes (e.g. git checkout, another editor).
   * Per-window tracking: each window can watch a different active file.
   */
  ipcMain.handle(
    FileChannels.WATCH_FILE,
    async (event, filePath: string | null) => {
      const winId = getWinIdFromSender(event.sender)

      // Close this window's previous watcher
      const existing = activeFileWatchers.get(winId)
      if (existing) {
        existing.watcher.close()
        activeFileWatchers.delete(winId)
      }

      if (!filePath) return

      try {
        const watcher = fsWatch(filePath, (eventType) => {
          if (eventType === 'change') {
            // Send fs-change to the specific window that's watching this file
            sendToWindow(winId, AppEventTypes.FS_CHANGE, {
              event: 'change',
              path: filePath,
            })
          }
        })
        activeFileWatchers.set(winId, { path: filePath, watcher })

        // Register cleanup so the watcher is closed when the window is destroyed
        onWindowClose(winId, () => {
          const existing = activeFileWatchers.get(winId)
          if (existing) {
            existing.watcher.close()
            activeFileWatchers.delete(winId)
          }
        })
      } catch (err) {
        console.error(`[File] Failed to watch file: ${filePath}`, err)
      }
    },
  )
}
