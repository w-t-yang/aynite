import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'
import { GitChannels } from '../../lib/constants/ipc-channels'
import {
  exists,
  getAbsolutePath,
  getRelativePath,
  joinPaths,
  toUnixPath,
} from '../../lib/path'
import { trackEvent } from '../telemetry/index'
import { getWorkspaceFolders } from '../workspace'
import { generateCommitMessage } from './commit-gen'
import { createGitWatcher } from './git-watcher'
import type { HunkData } from './porcelain'
import { buildHunkPatch, parseSplitPorcelain } from './porcelain'
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

    /**
     * Git expects forward slashes in pathspec arguments regardless of
     * platform. On Windows, `path.relative` returns backslashes, so we
     * normalize to forward slashes before passing to git commands.
     * Uses shared `toUnixPath()` from `src/lib/platform.ts`.
     */
    ipcMain.handle(
      GitChannels.HEAD_CONTENT,
      async (_event, filePath: string) => {
        try {
          const root = await this.rootFinder.findGitRoot(filePath)
          if (!root) return null
          const relative = toUnixPath(getRelativePath(root, filePath))
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
          const relative = toUnixPath(getRelativePath(root, filePath))
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

    ipcMain.handle(GitChannels.SPLIT_STATUS, async (_event, root: string) => {
      try {
        const { stdout } = await execAsync('git status --porcelain', {
          cwd: root,
        })
        return parseSplitPorcelain(stdout, root)
      } catch {
        return { staged: {}, unstaged: {} }
      }
    })

    ipcMain.handle(GitChannels.STAGE_FILE, async (_event, filePath: string) => {
      try {
        const root = await this.rootFinder.findGitRoot(filePath)
        if (!root) return { error: 'Not in a git repository' }
        const relative = toUnixPath(getRelativePath(root, filePath))
        await execAsync(`git add "${relative}"`, { cwd: root })
        await this.statusManager.refreshStatus(root, true)
        return { error: null }
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    })

    ipcMain.handle(
      GitChannels.UNSTAGE_FILE,
      async (_event, filePath: string) => {
        try {
          const root = await this.rootFinder.findGitRoot(filePath)
          if (!root) return { error: 'Not in a git repository' }
          const relative = toUnixPath(getRelativePath(root, filePath))
          await execAsync(`git restore --staged "${relative}"`, { cwd: root })
          await this.statusManager.refreshStatus(root, true)
          return { error: null }
        } catch (e: unknown) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      },
    )

    ipcMain.handle(GitChannels.STAGE_ALL, async (_event, root: string) => {
      try {
        await execAsync('git add -A', { cwd: root })
        await this.statusManager.refreshStatus(root, true)
        return { error: null }
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    })

    ipcMain.handle(GitChannels.UNSTAGE_ALL, async (_event, root: string) => {
      try {
        await execAsync('git restore --staged .', { cwd: root })
        await this.statusManager.refreshStatus(root, true)
        return { error: null }
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) }
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
          // Only commit staged changes — no `git add -A` here.
          // Use spawn with stdin to pass the commit message, avoiding all
          // shell escaping issues on Windows (PowerShell) and Unix.
          const commitProc = spawn('git', ['commit', '-F', '-'], {
            cwd: root,
            stdio: ['pipe', 'pipe', 'pipe'],
          })
          commitProc.stdin.write(message)
          commitProc.stdin.end()
          await new Promise<void>((resolve, reject) => {
            let stderr = ''
            commitProc.stderr.on('data', (d: Buffer) => {
              stderr += d.toString()
            })
            commitProc.on('close', (code) => {
              if (code === 0) resolve()
              else
                reject(
                  new Error(stderr || `git commit exited with code ${code}`),
                )
            })
            commitProc.on('error', reject)
          })
          trackEvent('git_commit')
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
