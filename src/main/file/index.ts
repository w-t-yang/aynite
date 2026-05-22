import { type FSWatcher, watch } from 'chokidar'
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
import { sendAppEvent } from '../window'
import { getWorkspaceFolders } from '../workspace'

let watcher: FSWatcher | null = null

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
      return true
    },
  )

  ipcMain.handle(
    FileChannels.RENAME,
    async (_event, { oldPath, newPath }: FileRenamePayload) => {
      await rename(oldPath, newPath)
      sendAppEvent(AppEventTypes.FILE_RENAMED, { oldPath, newPath })
      return true
    },
  )

  ipcMain.handle(
    FileChannels.COPY,
    async (_event, { srcPath, destPath }: FileCopyPayload) => {
      await copy(srcPath, destPath, { recursive: true })
      return true
    },
  )

  ipcMain.handle(FileChannels.DELETE, async (_event, filePath: string) => {
    await remove(filePath, { recursive: true, force: true })
    sendAppEvent(AppEventTypes.FILE_DELETED, { path: filePath })
    return true
  })

  ipcMain.handle(
    FileChannels.SAVE,
    async (_event, { path: filePath, content }: FileSavePayload) => {
      await writeText(filePath, content)
      return true
    },
  )

  ipcMain.handle(FileChannels.WATCHER_REFRESH, async () => {
    return await setupWatcher()
  })
}

export async function setupWatcher(folders?: string[]) {
  if (watcher) {
    watcher.close()
  }

  const watchFolders = folders || (await getWorkspaceFolders())
  if (!watchFolders || watchFolders.length === 0) return

  ;(async () => {
    try {
      const ignorePatterns = await getIgnorePatterns()
      watcher = watch(watchFolders, {
        ignored: (p) => {
          const basename = getBasename(p)
          if (watchFolders.includes(p)) return false
          return (
            Array.isArray(ignorePatterns) && ignorePatterns.includes(basename)
          )
        },
        persistent: true,
        ignoreInitial: true,
        depth: 99,
      })

      watcher.on('all', (event, path) => {
        sendAppEvent(AppEventTypes.FS_CHANGE, { event, path })
        gitService.handleFsChange(path)
      })
    } catch (e) {
      console.error('Error in setupWatcher ignore patterns:', e)
    }
  })()
}
