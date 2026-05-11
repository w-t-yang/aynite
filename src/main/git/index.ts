import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import { AppEvents } from '../../lib/constants/app'
import { GitChannels } from '../../lib/constants/ipc-channels'
import {
  exists,
  getAbsolutePath,
  getDirname,
  getRelativePath,
  joinPaths,
} from '../../lib/path'
import type { GitStatusType } from '../../lib/types/files'
import { sendAppEvent } from '../window'
import { getWorkspaceFolders } from '../workspace'

const execAsync = promisify(exec)

interface GitStatusMap {
  [path: string]: GitStatusType
}

class GitService {
  private statusCache: Map<string, GitStatusMap> = new Map()
  private rootCache: Map<string, string | null> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.setupIpc()
  }

  private setupIpc() {
    ipcMain.handle(GitChannels.STATUS, async (_event, path: string) => {
      const root = await this.findGitRoot(path)
      if (!root) return null

      const cached = this.statusCache.get(root)
      if (!cached) {
        await this.refreshStatus(root, true)
        return this.statusCache.get(root) || {}
      }
      return cached
    })

    ipcMain.handle('aynite:git-is-root', async (_event, path: string) => {
      const gitDir = joinPaths(getAbsolutePath(path), '.git')
      return await exists(gitDir)
    })

    ipcMain.handle(GitChannels.HEAD_CONTENT, async (_event, filePath: string) => {
      try {
        const root = await this.findGitRoot(filePath)
        if (!root) return null
        const relative = getRelativePath(root, filePath)
        const { stdout } = await execAsync(`git show HEAD:${relative}`, { cwd: root })
        return stdout
      } catch {
        return null
      }
    })
  }

  async findGitRoot(path: string): Promise<string | null> {
    const resolvedPath = getAbsolutePath(path)
    if (this.rootCache.has(resolvedPath)) {
      return this.rootCache.get(resolvedPath) ?? null
    }

    let current = resolvedPath
    while (current && current !== '/' && current !== '.') {
      const gitDir = joinPaths(current, '.git')
      if (await exists(gitDir)) {
        this.rootCache.set(resolvedPath, current)
        return current
      }
      const parent = getDirname(current)
      if (parent === current || !parent) break
      current = parent
    }

    this.rootCache.set(resolvedPath, null)
    return null
  }

  async refreshStatus(root: string, immediate = false) {
    if (!(await exists(joinPaths(root, '.git')))) return

    if (this.debounceTimers.has(root)) {
      clearTimeout(this.debounceTimers.get(root))
      this.debounceTimers.delete(root)
    }

    const execute = async () => {
      try {
        const { stdout } = await execAsync('git status --porcelain', {
          cwd: root,
        })
        const newStatus = this.parsePorcelain(stdout, root)

        const oldStatus = this.statusCache.get(root)
        if (JSON.stringify(oldStatus) !== JSON.stringify(newStatus)) {
          this.statusCache.set(root, newStatus)
          sendAppEvent(AppEvents.GIT_STATUS_CHANGED, {
            root,
            status: newStatus,
          })
        }
      } catch (e: any) {
        // SIGINT means the process was killed (e.g. app shutdown) — not a real error
        if (e?.signal === 'SIGINT') return
        console.error(`[GitService] Error refreshing status for ${root}:`, e)
      }
    }

    if (immediate) {
      await execute()
    } else {
      const timer = setTimeout(async () => {
        try {
          await execute()
        } finally {
          this.debounceTimers.delete(root)
        }
      }, 200)
      this.debounceTimers.set(root, timer)
    }
  }

  private parsePorcelain(stdout: string, root: string): GitStatusMap {
    const statusMap: GitStatusMap = {}
    const lines = stdout.split('\n')

    for (const line of lines) {
      if (!line || line.length < 3) continue
      const code = line.slice(0, 2)
      let filePath = line.slice(3)

      // Handle renames: "R  old -> new"
      if (code.startsWith('R')) {
        filePath = filePath.split(' -> ').pop() || filePath
      }

      // Remove quotes if present
      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1)
      }

      // Normalize trailing slashes
      if (filePath.endsWith('/') || filePath.endsWith('\\')) {
        filePath = filePath.slice(0, -1)
      }

      const status = this.mapCodeToStatus(code)
      const absPath = joinPaths(root, filePath)
      statusMap[absPath] = status

      // Propagate to parents
      if (status !== 'ignored' && status !== 'none') {
        let parent = getDirname(absPath)
        while (
          parent &&
          parent.length >= root.length &&
          parent.startsWith(root)
        ) {
          if (!statusMap[parent] || statusMap[parent] === 'none') {
            statusMap[parent] = 'modified'
          }
          const nextParent = getDirname(parent)
          if (nextParent === parent) break
          parent = nextParent
        }
      }
    }

    return statusMap
  }

  private mapCodeToStatus(code: string): GitStatusType {
    const X = code[0]
    const Y = code[1]

    if (X === '?' && Y === '?') return 'untracked'
    if (X === '!' && Y === '!') return 'ignored'
    if (X === 'A') return 'added'
    if (X === 'M' || Y === 'M') return 'modified'
    if (X === 'D' || Y === 'D') return 'deleted'
    if (X === 'R') return 'renamed'
    if (X === 'C') return 'renamed'

    return 'none'
  }

  async handleFsChange(path: string) {
    const root = await this.findGitRoot(path)
    if (root) {
      await this.refreshStatus(root)
    }
  }

  async clearCaches() {
    this.rootCache.clear()
    this.statusCache.clear()
  }
}

let instance: GitService | null = null

export function setupGitIpc() {
  if (!instance) {
    instance = new GitService()

    // Forced initial refresh for all workspace folders
    getWorkspaceFolders().then((folders) => {
      for (const folder of folders) {
        instance?.refreshStatus(folder, true)
      }
    })
  }
}

export const gitService = {
  handleFsChange: (path: string) => instance?.handleFsChange(path),
  clearCaches: () => instance?.clearCaches(),
}
