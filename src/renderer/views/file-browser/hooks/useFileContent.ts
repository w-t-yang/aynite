/**
 * Hook for file content loading, refresh, and saving.
 *
 * Manages content state, original content for dirty tracking,
 * file info, loading/error states, fs-change debounced refresh,
 * and save operations.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileInfo } from '../../../../lib/types/files'
import { file as bridgeFile, fileMutations } from '../../../bridge/file'
import { normalizePath } from '../../../shared/lib/utils'
import { useViewEvent } from '../../useViewEvents'

export function useFileContent(activePath: string | null) {
  const [content, setContent] = useState<string | null>(null)
  const [originalContent, setOriginalContent] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isText, setIsText] = useState(false)

  const isDirty = content !== originalContent && activePath !== null

  // Load file content when activePath changes
  useEffect(() => {
    if (!activePath) {
      setContent(null)
      setFileInfo(null)
      setError(null)
      return
    }

    setContent(null)
    setOriginalContent(null)
    setFileInfo(null)
    setError(null)

    const loadFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const textStatus = await bridgeFile.checkIsText(activePath)
        setIsText(textStatus)
        const info = await bridgeFile.info(activePath)
        setFileInfo({
          ...info,
          createdAt: new Date(info.createdAt),
          modifiedAt: new Date(info.modifiedAt),
        })

        if (textStatus) {
          const text = await bridgeFile.read(activePath)
          setContent(text)
          setOriginalContent(text)
        } else {
          setContent(null)
          setOriginalContent(null)
        }
      } catch (err: unknown) {
        const rawMessage =
          err instanceof Error ? err.message : 'Failed to load file'
        // Electron wraps IPC errors as "Error invoking remote method '<channel>': Error: <original message>"
        // Extract just the meaningful part for display
        const message = rawMessage.replace(
          /^Error invoking remote method '[^']+': Error:\s*/,
          '',
        )
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [activePath])

  // Watch only the currently open file for external changes
  useEffect(() => {
    fileMutations.watch(activePath)
  }, [activePath])

  // Debounce timer for fs-change events
  const fsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable fs-change handler to avoid listener thrashing in useViewEvent
  const handleFsChange = useCallback(
    (data: { event: string; path: string }) => {
      if (!activePath) return
      const normalizedChanged = data.path.replace(/\\/g, '/')
      const normalizedActive = activePath.replace(/\\/g, '/')

      if (normalizedChanged === normalizedActive && data.event === 'change') {
        if (fsChangeTimerRef.current) {
          clearTimeout(fsChangeTimerRef.current)
        }
        fsChangeTimerRef.current = setTimeout(async () => {
          fsChangeTimerRef.current = null
          try {
            const textStatus = await bridgeFile.checkIsText(activePath)
            setIsText(textStatus)
            if (textStatus) {
              const text = await bridgeFile.read(activePath)
              setContent(text)
              setOriginalContent(text)
            }
            const info = await bridgeFile.info(activePath)
            setFileInfo({
              ...info,
              createdAt: new Date(info.createdAt),
              modifiedAt: new Date(info.modifiedAt),
            })
          } catch (e) {
            console.error('Failed to refresh file on disk change', e)
          }
        }, 200)
      }
    },
    [activePath],
  )
  useViewEvent('fs-change', handleFsChange)

  // After a git discard-hunk or commit, the file on disk may have changed
  // (discard-hunk applies reverse patch to the working tree).
  // Re-read the file content if the current file is in the affected git root.
  // We check dirty state via a ref to avoid stale closure issues.
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  const handleGitStatusChanged = useCallback(
    (data: { root: string }) => {
      if (!activePath || !data?.root) return
      if (
        normalizePath(activePath).startsWith(normalizePath(data.root)) &&
        !isDirtyRef.current
      ) {
        // Only re-read if the file isn't dirty (user hasn't unsaved edits)
        if (fsChangeTimerRef.current) {
          clearTimeout(fsChangeTimerRef.current)
        }
        fsChangeTimerRef.current = setTimeout(async () => {
          fsChangeTimerRef.current = null
          try {
            const textStatus = await bridgeFile.checkIsText(activePath)
            setIsText(textStatus)
            if (textStatus) {
              const text = await bridgeFile.read(activePath)
              setContent(text)
              setOriginalContent(text)
            }
          } catch (e) {
            console.error('Failed to refresh file after git operation', e)
          }
        }, 200)
      }
    },
    [activePath],
  )
  useViewEvent('git-status-changed', handleGitStatusChanged)

  const handleSave = useCallback(async () => {
    if (!activePath || content === null) return
    try {
      await fileMutations.write(activePath, content)
      setOriginalContent(content)
    } catch (e) {
      console.error('Failed to save file:', e)
    }
  }, [activePath, content])

  return {
    content,
    setContent,
    originalContent,
    fileInfo,
    loading,
    error,
    isText,
    isDirty,
    handleSave,
  } as const
}
