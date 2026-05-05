import { ipcMain } from 'electron'
import { FileChannels } from '../../lib/constants/ipc-channels'
import {
  checkIsTextFile,
  copy,
  ensureDir,
  expandHome,
  getAbsolutePath,
  getExtname,
  joinPaths,
  readdir,
  readText,
  remove,
  rename,
  stat,
  writeText,
} from '../../lib/path'
import { getIgnorePatterns } from '../config'
import { removeWorkspaceFolder, renameWorkspaceFolder } from '../workspace'

// ─── Payload types ─────────────────────────────────────────────────────────
export interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

export interface FileInfoResult {
  size: number
  createdAt: Date
  modifiedAt: Date
  isDirectory: boolean
  path: string
  extension: string
  isText: boolean
}

export interface FileCreatePayload {
  path: string
  isDirectory: boolean
}

export interface FileRenamePayload {
  oldPath: string
  newPath: string
}

export interface FileCopyPayload {
  srcPath: string
  destPath: string
}

export interface FileSavePayload {
  path: string
  content: string
}

export interface FsChangeEvent {
  event: string
  path: string
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

  ipcMain.handle(FileChannels.INFO, async (_event, filePath: string) => {
    const expandedPath = expandHome(filePath)
    const s = await stat(expandedPath)
    const isText = s.isDirectory() ? false : await checkIsTextFile(expandedPath)

    return {
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
      await renameWorkspaceFolder(oldPath, newPath)
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
    await removeWorkspaceFolder(filePath)
    return true
  })

  ipcMain.handle(
    FileChannels.SAVE,
    async (_event, { path: filePath, content }: FileSavePayload) => {
      await writeText(filePath, content)
      return true
    },
  )
}
