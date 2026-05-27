/**
 * Git watcher — watches .git/HEAD and .git/index for external git operations
 * (checkout, reset, stash, add) and triggers a status refresh callback.
 *
 * Uses Node's built-in fs.watch — only 2 files per git root.
 */
import { type FSWatcher, watch as fsWatch } from 'node:fs'
import { exists, joinPaths } from '../../lib/path'

type StatusRefreshFn = (root: string) => void

export function createGitWatcher(onRefresh: StatusRefreshFn) {
  const gitWatchers = new Map<string, { head?: FSWatcher; index?: FSWatcher }>()

  async function setupWatcher(root: string) {
    teardownWatcher(root)

    const gitDir = joinPaths(root, '.git')
    const headPath = joinPaths(gitDir, 'HEAD')
    const indexPath = joinPaths(gitDir, 'index')

    const headExists = await exists(headPath)
    const indexExists = await exists(indexPath)

    if (!headExists && !indexExists) {
      return
    }

    const watchers: { head?: FSWatcher; index?: FSWatcher } = {}

    if (headExists) {
      try {
        watchers.head = fsWatch(headPath, () => {
          onRefresh(root)
        })
      } catch (err) {
        console.error(`[GitWatcher] Failed to watch ${headPath}:`, err)
      }
    }

    if (indexExists) {
      try {
        watchers.index = fsWatch(indexPath, () => {
          onRefresh(root)
        })
      } catch (err) {
        console.error(`[GitWatcher] Failed to watch ${indexPath}:`, err)
      }
    }

    gitWatchers.set(root, watchers)
  }

  function teardownWatcher(root: string) {
    const watchers = gitWatchers.get(root)
    if (watchers) {
      watchers.head?.close()
      watchers.index?.close()
      gitWatchers.delete(root)
    }
  }

  function refreshWatchers(folders: string[]) {
    for (const [root] of gitWatchers) {
      if (!folders.some((f) => f === root || f.startsWith(`${root}/`))) {
        teardownWatcher(root)
      }
    }

    for (const _folder of folders) {
      // setupWatcher is async — caller must ensure findGitRoot runs first
    }
  }

  /** Async variant that resolves git roots first, then sets up watchers */
  async function refreshWatchersAsync(
    folders: string[],
    findGitRoot: (path: string) => Promise<string | null>,
  ) {
    for (const [root] of gitWatchers) {
      if (!folders.some((f) => f === root || f.startsWith(`${root}/`))) {
        teardownWatcher(root)
      }
    }

    for (const folder of folders) {
      const root = await findGitRoot(folder)
      if (root) {
        await setupWatcher(root)
      }
    }
  }

  return {
    setupWatcher,
    teardownWatcher,
    refreshWatchers,
    refreshWatchersAsync,
  }
}
