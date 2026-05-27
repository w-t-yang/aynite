/**
 * Git status manager — runs `git status --porcelain`, caches results,
 * debounces rapid changes, and broadcasts changes via app events.
 */
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { AppEvents } from '../../lib/constants/app'
import { exists, joinPaths } from '../../lib/path'
import { broadcastAppEvent } from '../window'
import type { GitStatusMap } from './porcelain'
import { parsePorcelain } from './porcelain'
import type { RootFinder } from './root-finder'

const execAsync = promisify(exec)

export function createStatusManager(rootFinder: RootFinder) {
  const statusCache = new Map<string, GitStatusMap>()
  const debounceTimers = new Map<string, NodeJS.Timeout>()

  async function refreshStatus(root: string, immediate = false) {
    if (!(await exists(joinPaths(root, '.git')))) return

    if (debounceTimers.has(root)) {
      clearTimeout(debounceTimers.get(root))
      debounceTimers.delete(root)
    }

    const execute = async () => {
      try {
        const { stdout } = await execAsync('git status --porcelain', {
          cwd: root,
        })
        const newStatus = parsePorcelain(stdout, root)

        const oldStatus = statusCache.get(root)
        if (JSON.stringify(oldStatus) !== JSON.stringify(newStatus)) {
          statusCache.set(root, newStatus)
          broadcastAppEvent(AppEvents.GIT_STATUS_CHANGED, {
            root,
            status: newStatus,
          })
        }
      } catch (e: any) {
        if (e?.signal === 'SIGINT') return
        console.error(
          `[GitStatusManager] Error refreshing status for ${root}:`,
          e,
        )
      }
    }

    if (immediate) {
      await execute()
    } else {
      const timer = setTimeout(async () => {
        try {
          await execute()
        } finally {
          debounceTimers.delete(root)
        }
      }, 200)
      debounceTimers.set(root, timer)
    }
  }

  function getStatus(root: string): GitStatusMap | undefined {
    return statusCache.get(root)
  }

  async function handleFsChange(path: string) {
    const root = await rootFinder.findGitRoot(path)
    if (root) {
      await refreshStatus(root)
    }
  }

  function clearCache() {
    statusCache.clear()
  }

  return { refreshStatus, getStatus, handleFsChange, clearCache }
}
