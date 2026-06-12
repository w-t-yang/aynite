import { useCallback, useRef, useState } from 'react'
import type { GitStatusType } from '../../../../lib/types/files'
import { git } from '../../../bridge/git'
import { normalizePath } from '../../../shared/lib/utils'
import { useViewEvent } from '../../useViewEvents'

interface GitStatusMap {
  [path: string]: GitStatusType
}

export function useGitStatus() {
  const [gitStatuses, setGitStatuses] = useState<GitStatusMap>({})
  const [gitRoots, setGitRoots] = useState<Set<string>>(new Set())

  const fetchStatus = useCallback(async (path: string) => {
    try {
      const [status, isRoot] = await Promise.all([
        git.getStatus(path),
        git.checkIsRoot(path),
      ])
      if (isRoot) {
        setGitRoots((prev) => new Set(prev).add(path))
      }
      if (status) {
        // Normalize status map keys for consistent comparison
        const normalized: GitStatusMap = {}
        for (const [key, val] of Object.entries(
          status as Record<string, GitStatusType>,
        )) {
          normalized[normalizePath(key)] = val
        }
        setGitStatuses((prev) => ({ ...prev, ...normalized }))
      }
    } catch (e) {
      console.error('[useGitStatus] Failed to fetch git status:', e)
    }
  }, [])

  // Stable callback ref to prevent listener thrashing (re-registration on every render)
  const handleGitStatusChangedRef = useRef(
    (data: { root: string; status: GitStatusMap }) => {
      if (data?.status) {
        const normalizedRoot = normalizePath(data.root)
        // Also normalize the incoming status map keys
        const normalizedStatus: GitStatusMap = {}
        for (const [key, val] of Object.entries(data.status)) {
          normalizedStatus[normalizePath(key)] = val
        }

        setGitStatuses((prev) => {
          const next = { ...prev }
          const rootPrefix = `${normalizedRoot}/`
          for (const path in next) {
            const normalizedPath = normalizePath(path)
            if (
              normalizedPath === normalizedRoot ||
              normalizedPath.startsWith(rootPrefix)
            ) {
              delete next[path]
            }
          }
          return { ...next, ...normalizedStatus }
        })
      }
    },
  )

  // Stable reference that never changes, so the event listener never re-registers
  useViewEvent('git-status-changed', handleGitStatusChangedRef.current)

  return { gitStatuses, gitRoots, fetchStatus }
}
