import { useCallback, useRef, useState } from 'react'
import type { GitStatusType } from '../../../../lib/types/files'
import { useAppEvent } from '../../ViewContext'

interface GitStatusMap {
  [path: string]: GitStatusType
}

export function useGitStatus() {
  const [gitStatuses, setGitStatuses] = useState<GitStatusMap>({})
  const [gitRoots, setGitRoots] = useState<Set<string>>(new Set())

  const fetchStatus = useCallback(async (path: string) => {
    try {
      const [status, isRoot] = await Promise.all([
        (window as any).aynite.getGitStatus(path),
        (window as any).aynite.checkIsGitRoot(path),
      ])
      if (isRoot) {
        setGitRoots((prev) => new Set(prev).add(path))
      }
      if (status) {
        setGitStatuses((prev) => ({ ...prev, ...status }))
      }
    } catch (e) {
      console.error('[useGitStatus] Failed to fetch git status:', e)
    }
  }, [])

  // Stable callback ref to prevent listener thrashing (re-registration on every render)
  const handleGitStatusChangedRef = useRef(
    (data: { root: string; status: GitStatusMap }) => {
      if (data?.status) {
        setGitStatuses((prev) => {
          const next = { ...prev }
          for (const path in next) {
            if (
              path === data.root ||
              path.startsWith(`${data.root}/`) ||
              path.startsWith(`${data.root}\\`)
            ) {
              delete next[path]
            }
          }
          return { ...next, ...data.status }
        })
      }
    },
  )

  // Stable reference that never changes, so the event listener never re-registers
  useAppEvent('git-status-changed', handleGitStatusChangedRef.current)

  return { gitStatuses, gitRoots, fetchStatus }
}
