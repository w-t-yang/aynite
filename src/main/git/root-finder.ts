/**
 * Git root finder — walks up the directory tree to find the nearest .git directory.
 * Maintains an in-memory cache of resolved paths.
 */
import { exists, getAbsolutePath, getDirname, joinPaths } from '../../lib/path'
import type { RootFinder } from '../../lib/types/files'

export type { RootFinder }

export function createRootFinder(): RootFinder {
  const rootCache = new Map<string, string | null>()

  async function findGitRoot(path: string): Promise<string | null> {
    const resolvedPath = getAbsolutePath(path)
    if (rootCache.has(resolvedPath)) {
      return rootCache.get(resolvedPath) ?? null
    }

    let current = resolvedPath
    while (current && current !== '/' && current !== '.') {
      const gitDir = joinPaths(current, '.git')
      if (await exists(gitDir)) {
        rootCache.set(resolvedPath, current)
        return current
      }
      const parent = getDirname(current)
      if (parent === current || !parent) break
      current = parent
    }

    rootCache.set(resolvedPath, null)
    return null
  }

  function clearCache() {
    rootCache.clear()
  }

  return { findGitRoot, clearCache }
}
