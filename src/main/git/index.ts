import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import { GitChannels } from '../../lib/constants/ipc-channels'
import {
  exists,
  getAbsolutePath,
  getRelativePath,
  joinPaths,
} from '../../lib/path'
import { execInUserShell } from '../system'
import { getWorkspaceFolders } from '../workspace'
import { generateCommitMessage } from './commit-gen'
import { createGitWatcher } from './git-watcher'
import type { HunkData } from './porcelain'
import { buildHunkPatch } from './porcelain'
import { createRootFinder } from './root-finder'
import { createStatusManager } from './status-manager'

const execAsync = promisify(exec)

function spawnGitPatch(
  args: string[],
  patch: string,
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd })
    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `git exited with code ${code}`))
    })
    proc.on('error', reject)
    proc.stdin.end(patch)
  })
}

class GitService {
  private rootFinder = createRootFinder()
  private statusManager = createStatusManager(this.rootFinder)
  private gitWatcher = createGitWatcher((root) =>
    this.statusManager.refreshStatus(root),
  )

  constructor() {
    this.setupIpc()
  }

  private setupIpc() {
    ipcMain.handle(GitChannels.STATUS, async (_event, path: string) => {
      const root = await this.rootFinder.findGitRoot(path)
      if (!root) return null
      const cached = this.statusManager.getStatus(root)
      if (!cached) {
        await this.statusManager.refreshStatus(root, true)
        return this.statusManager.getStatus(root) || {}
      }
      return cached
    })

    ipcMain.handle(GitChannels.REFRESH_STATUS, async (_event, path: string) => {
      const root = await this.rootFinder.findGitRoot(path)
      if (!root) return null
      await this.statusManager.refreshStatus(root, true)
      return this.statusManager.getStatus(root) || {}
    })

    ipcMain.handle('aynite:git-is-root', async (_event, path: string) => {
      const gitDir = joinPaths(getAbsolutePath(path), '.git')
      return await exists(gitDir)
    })

    ipcMain.handle(
      GitChannels.HEAD_CONTENT,
      async (_event, filePath: string) => {
        try {
          const root = await this.rootFinder.findGitRoot(filePath)
          if (!root) return null
          const relative = getRelativePath(root, filePath)
          const { stdout } = await execAsync(`git show HEAD:${relative}`, {
            cwd: root,
          })
          return stdout
        } catch {
          return null
        }
      },
    )

    ipcMain.handle(
      GitChannels.INDEX_CONTENT,
      async (_event, filePath: string) => {
        try {
          const root = await this.rootFinder.findGitRoot(filePath)
          if (!root) return null
          const relative = getRelativePath(root, filePath)
          try {
            const { stdout } = await execAsync(`git show :${relative}`, {
              cwd: root,
            })
            return stdout
          } catch {
            try {
              const { stdout } = await execAsync(`git show HEAD:${relative}`, {
                cwd: root,
              })
              return stdout
            } catch {
              return null
            }
          }
        } catch {
          return null
        }
      },
    )

    ipcMain.handle(GitChannels.STAGE_HUNK, async (_event, data: HunkData) => {
      try {
        const root = await this.rootFinder.findGitRoot(data.filePath)
        if (!root) return { error: 'Not in a git repository' }
        const relative = getRelativePath(root, data.filePath)
        const patch = buildHunkPatch(relative, data)
        await spawnGitPatch(
          ['apply', '--cached', '--unidiff-zero'],
          patch,
          root,
        )
        await this.statusManager.refreshStatus(root, true)
        return { error: null }
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    })

    ipcMain.handle(GitChannels.DISCARD_HUNK, async (_event, data: HunkData) => {
      try {
        const root = await this.rootFinder.findGitRoot(data.filePath)
        if (!root) return { error: 'Not in a git repository' }
        const relative = getRelativePath(root, data.filePath)
        const patch = buildHunkPatch(relative, data)
        await spawnGitPatch(
          ['apply', '--reverse', '--unidiff-zero'],
          patch,
          root,
        )
        await this.statusManager.refreshStatus(root, true)
        return { error: null }
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    })

    ipcMain.handle(GitChannels.DIFF_STATS, async (_event, root: string) => {
      const { parseNumstat } = await import('./porcelain')
      try {
        const [{ stdout: unstaged }, { stdout: staged }] = await Promise.all([
          execAsync('git diff --numstat', { cwd: root }),
          execAsync('git diff --cached --numstat', { cwd: root }),
        ])
        return {
          ...parseNumstat(unstaged, root),
          ...parseNumstat(staged, root),
        }
      } catch {
        return {}
      }
    })

    ipcMain.handle(
      GitChannels.COMMIT_GENERATE,
      async (_event, root: string) => {
        return await generateCommitMessage(root)
      },
    )

    ipcMain.handle(
      GitChannels.COMMIT_EXECUTE,
      async (_event, root: string, message: string) => {
        try {
          if (!message.trim()) {
            return { error: 'Commit message cannot be empty' }
          }
          await execAsync('git add -A', { cwd: root })
          const escapedMsg = message.replace(/'/g, "'\\''")
          await execInUserShell(`git commit -m '${escapedMsg}'`, {
            cwd: root,
          })
          await this.statusManager.refreshStatus(root, true)
          return { success: true }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          return { error: errorMsg }
        }
      },
    )
  }

  async handleFsChange(path: string) {
    await this.statusManager.handleFsChange(path)
  }

  async clearCaches() {
    this.rootFinder.clearCache()
    this.statusManager.clearCache()
  }

  refreshWatchers(folders: string[]) {
    this.gitWatcher.refreshWatchers(folders)
  }
}

let instance: GitService | null = null

export function setupGitIpc() {
  if (!instance) {
    instance = new GitService()

    getWorkspaceFolders().then((folders) => {
      for (const folder of folders) {
        instance?.handleFsChange(folder)
      }
      instance?.refreshWatchers(folders)
    })
  }
}

const gitService = {
  handleFsChange: (path: string) => instance?.handleFsChange(path),
  clearCaches: () => instance?.clearCaches(),
  refreshWatchers: (folders: string[]) => instance?.refreshWatchers(folders),
}

export { gitService }
