import { exec, spawn } from 'node:child_process'
import { type FSWatcher, watch as fsWatch } from 'node:fs'
import { promisify } from 'node:util'
import { streamText } from 'ai'
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
import { DISABLED_REASONING_OPTIONS, getAIModel } from '../ai'
import { loadConfig } from '../config'
import { execInUserShell } from '../system'
import { broadcastAppEvent } from '../window'
import { getWorkspaceFolders } from '../workspace'
import type { GitStatusMap, HunkData } from './porcelain'
import { buildHunkPatch, parseNumstat, parsePorcelain } from './porcelain'

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
  private statusCache: Map<string, GitStatusMap> = new Map()
  private rootCache: Map<string, string | null> = new Map()
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private gitWatchers: Map<string, { head?: FSWatcher; index?: FSWatcher }> =
    new Map()

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

    ipcMain.handle(GitChannels.REFRESH_STATUS, async (_event, path: string) => {
      const root = await this.findGitRoot(path)
      if (!root) return null

      await this.refreshStatus(root, true)
      return this.statusCache.get(root) || {}
    })

    ipcMain.handle('aynite:git-is-root', async (_event, path: string) => {
      const gitDir = joinPaths(getAbsolutePath(path), '.git')
      return await exists(gitDir)
    })

    ipcMain.handle(
      GitChannels.HEAD_CONTENT,
      async (_event, filePath: string) => {
        try {
          const root = await this.findGitRoot(filePath)
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
          const root = await this.findGitRoot(filePath)
          if (!root) return null
          const relative = getRelativePath(root, filePath)
          // Index content (staged) — fall back to HEAD if not in index
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
        const root = await this.findGitRoot(data.filePath)
        if (!root) return { error: 'Not in a git repository' }
        const relative = getRelativePath(root, data.filePath)
        const patch = buildHunkPatch(relative, data)
        await spawnGitPatch(
          ['apply', '--cached', '--unidiff-zero'],
          patch,
          root,
        )
        await this.refreshStatus(root, true)
        return { error: null }
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    })

    ipcMain.handle(GitChannels.DISCARD_HUNK, async (_event, data: HunkData) => {
      try {
        const root = await this.findGitRoot(data.filePath)
        if (!root) return { error: 'Not in a git repository' }
        const relative = getRelativePath(root, data.filePath)
        const patch = buildHunkPatch(relative, data)
        await spawnGitPatch(
          ['apply', '--reverse', '--unidiff-zero'],
          patch,
          root,
        )
        await this.refreshStatus(root, true)
        return { error: null }
      } catch (e: unknown) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    })

    ipcMain.handle(GitChannels.DIFF_STATS, async (_event, root: string) => {
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

    // ─── Commit Message Generation ───────────────────────────────────────

    const COMPACT_DIFF_MAX = 2000

    ipcMain.handle(
      GitChannels.COMMIT_GENERATE,
      async (_event, root: string) => {
        try {
          // Get changed files (staged + unstaged) and their stats
          const results = await Promise.allSettled([
            execAsync('git status --short', { cwd: root }),
            execAsync('git diff --stat', { cwd: root }),
            execAsync('git diff --cached --stat', { cwd: root }),
          ])

          const statusShort =
            results[0].status === 'fulfilled' ? results[0].value.stdout : ''
          const unstagedStat =
            results[1].status === 'fulfilled' ? results[1].value.stdout : ''
          const stagedStat =
            results[2].status === 'fulfilled' ? results[2].value.stdout : ''

          const changedFiles = statusShort
            .split('\n')
            .filter(Boolean)
            .map((line: string) => {
              // XY <space> file
              // X = staging area, Y = working tree
              const X = line[0]
              const Y = line[1]
              const file = line.slice(3).trim()
              const prefix =
                X !== ' ' && X !== '?' ? `[staged] ` : `[unstaged] `
              const typeMap: Record<string, string> = {
                M: 'modified',
                A: 'added',
                D: 'deleted',
                R: 'renamed',
                '?': 'untracked',
              }
              const statusType =
                X !== ' ' && X !== '?'
                  ? typeMap[X] || 'changed'
                  : typeMap[Y] || 'changed'
              return `${prefix}${statusType}: ${file}`
            })
            .join('\n')

          if (!changedFiles) {
            console.warn(
              '[GitService] No changed files found. statusShort:',
              JSON.stringify(statusShort),
            )
            return { error: 'No changes to commit' }
          }

          // Get compact diff excerpts (staged + unstaged) if small enough
          let detailContext = ''
          for (const flag of ['--cached', '']) {
            try {
              const { stdout: diff } = await execAsync(
                `git diff ${flag} --unified=2`,
                { cwd: root, maxBuffer: 1024 * 10 },
              )
              if (diff.length > 0 && diff.length < COMPACT_DIFF_MAX) {
                detailContext += `\n${flag ? 'Staged' : 'Unstaged'} diff:\n${diff.slice(0, COMPACT_DIFF_MAX)}`
              }
            } catch {
              // skip if too large
            }
          }

          const statBlock = [stagedStat?.trim(), unstagedStat?.trim()]
            .filter(Boolean)
            .join('\n')
          const diffContent = `Files changed:\n${changedFiles}\n\nStats:\n${statBlock}${detailContext}`

          // Read AI config using loadConfig() — same path as the chat flow,
          // ensures provider URLs are normalized and config is repaired
          const mainConfig = await loadConfig()
          const aiConfig = mainConfig?.ai
          if (!aiConfig?.providers || aiConfig.providers.length === 0) {
            return { error: 'No AI provider configured' }
          }

          const activeId = aiConfig.activeId
          const activeProvider =
            aiConfig.providers.find((p: any) => p.id === activeId) ||
            aiConfig.providers[0]

          const modelName = activeProvider.model || activeProvider.name || 'AI'

          let model
          try {
            model = getAIModel(activeProvider)
          } catch (modelErr: unknown) {
            const msg =
              modelErr instanceof Error ? modelErr.message : String(modelErr)
            console.error('[GitService] Failed to create AI model:', msg)
            return { error: `AI model error: ${msg}` }
          }

          const systemPrompt = `You generate short commit messages only. Never reason or think aloud — output just the commit message.

Format:
{type}: {short summary}

- {specific change}
- {specific change}

Type: feat, fix, chore, refactor, docs, test, style.
Last line: Generated by Aynite (${modelName})

Example:
feat: add user authentication

- Implement login form with validation
- Add JWT token generation
- Store session data

Generated by Aynite (${modelName})`

          const userMessage = `Write a commit message for:

${diffContent.slice(0, 1200)}`

          let text: string
          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 30000)
            const result = streamText({
              model,
              system: systemPrompt,
              messages: [{ role: 'user', content: userMessage }],
              maxOutputTokens: 300,
              temperature: 0.6,
              abortSignal: controller.signal,
              providerOptions: DISABLED_REASONING_OPTIONS,
            })

            let fullText = ''
            for await (const part of result.fullStream) {
              if (part.type === 'text-delta') {
                fullText += part.text
              }
            }
            clearTimeout(timeout)
            text = fullText
          } catch (genErr: unknown) {
            const genMsg =
              genErr instanceof Error ? genErr.message : String(genErr)
            console.error(
              '[GitService] streamText threw:',
              genMsg,
              genErr instanceof Error ? genErr.stack : '',
            )
            return { error: `AI generation failed: ${genMsg}` }
          }

          if (!text?.trim()) {
            console.error('[GitService] streamText returned empty text')
            return { error: 'AI returned empty response' }
          }

          // Clean up the generated message
          const body = text
            .replace(/^```(?:text)?\n?/, '')
            .replace(/\n?```$/, '')
            .trim()

          if (!body) {
            console.error(
              '[GitService] Cleaned message is empty. Raw text:',
              JSON.stringify(text),
            )
            return { error: 'Failed to generate a commit message' }
          }

          // Ensure the attribution line is present (in case AI forgets)
          const message = body.includes('Generated by Aynite')
            ? body
            : `${body}\n\nGenerated by Aynite (${modelName})`

          return { message, modelName }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          console.error(
            '[GitService] Commit generate failed:',
            errorMsg,
            e instanceof Error ? e.stack : '',
          )
          return { error: errorMsg }
        }
      },
    )

    // ─── Commit Execution ───────────────────────────────────────────────

    ipcMain.handle(
      GitChannels.COMMIT_EXECUTE,
      async (_event, root: string, message: string) => {
        try {
          if (!message.trim()) {
            return { error: 'Commit message cannot be empty' }
          }

          // Stage all changes (both tracked and untracked)
          await execAsync('git add -A', { cwd: root })

          // Execute commit through user's login shell so git hooks can find tools (npx, etc.)
          const escapedMsg = message.replace(/'/g, "'\\''")
          await execInUserShell(`git commit -m '${escapedMsg}'`, {
            cwd: root,
          })

          await this.refreshStatus(root, true)
          return { success: true }
        } catch (e: unknown) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          return { error: errorMsg }
        }
      },
    )
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
          broadcastAppEvent(AppEvents.GIT_STATUS_CHANGED, {
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

  // Delegates to extracted porcelain.ts — kept for backward compat with
  // the private method references in this class.
  private parsePorcelain(stdout: string, root: string): GitStatusMap {
    return parsePorcelain(stdout, root)
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

  // ── Lightweight .git metadata watcher ─────────────────────────────────
  // Watches .git/HEAD (changes on checkout/reset/rebase) and .git/index
  // (changes on add/reset/stash) to trigger git status refresh for external
  // git operations. Uses Node's built-in fs.watch — only 2 files per root.

  async setupGitWatcher(root: string) {
    // Clean up any existing watcher for this root
    this.teardownGitWatcher(root)

    const gitDir = joinPaths(root, '.git')
    const headPath = joinPaths(gitDir, 'HEAD')
    const indexPath = joinPaths(gitDir, 'index')

    const headExists = await exists(headPath)
    const indexExists = await exists(indexPath)

    if (!headExists && !indexExists) {
      // Not a standard git repo (could be a submodule or worktree with
      // a .git file instead of directory) — skip watching
      return
    }

    const watchers: { head?: FSWatcher; index?: FSWatcher } = {}

    if (headExists) {
      try {
        watchers.head = fsWatch(headPath, () => {
          this.refreshStatus(root)
        })
      } catch (err) {
        console.error(`[GitService] Failed to watch ${headPath}:`, err)
      }
    }

    if (indexExists) {
      try {
        watchers.index = fsWatch(indexPath, () => {
          this.refreshStatus(root)
        })
      } catch (err) {
        console.error(`[GitService] Failed to watch ${indexPath}:`, err)
      }
    }

    this.gitWatchers.set(root, watchers)
  }

  teardownGitWatcher(root: string) {
    const watchers = this.gitWatchers.get(root)
    if (watchers) {
      watchers.head?.close()
      watchers.index?.close()
      this.gitWatchers.delete(root)
    }
  }

  refreshWatchers(folders: string[]) {
    // Teardown watchers for roots that are no longer in the folder list
    for (const [root] of this.gitWatchers) {
      if (!folders.some((f) => f === root || f.startsWith(`${root}/`))) {
        this.teardownGitWatcher(root)
      }
    }

    // Setup watchers for current folders
    for (const folder of folders) {
      this.findGitRoot(folder).then((root) => {
        if (root) {
          this.setupGitWatcher(root)
        }
      })
    }
  }
}

let instance: GitService | null = null

export function setupGitIpc() {
  if (!instance) {
    instance = new GitService()

    // Forced initial refresh + start .git watchers for all workspace folders
    getWorkspaceFolders().then((folders) => {
      for (const folder of folders) {
        instance?.refreshStatus(folder, true)
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
