/**
 * Hook for file content loading, refresh, and saving.
 *
 * Manages content state, original content for dirty tracking,
 * file info, loading/error states, fs-change debounced refresh,
 * and save operations.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileInfo } from '../../../../lib/types/files'
import { useAppEvent } from '../../ViewContext'

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
      return
    }

    setContent(null)
    setOriginalContent(null)
    setFileInfo(null)

    const loadFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const textStatus = await window.aynite.checkIsTextFile(activePath)
        setIsText(textStatus)
        const info = await window.aynite.getFileInfo(activePath)
        setFileInfo({
          ...info,
          createdAt: new Date(info.createdAt),
          modifiedAt: new Date(info.modifiedAt),
        })

        if (textStatus) {
          const text = await window.aynite.readFile(activePath)
          setContent(text)
          setOriginalContent(text)
        } else {
          setContent(null)
          setOriginalContent(null)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [activePath])

  // Watch only the currently open file for external changes
  useEffect(() => {
    window.aynite.watchFile(activePath)
  }, [activePath])

  // Debounce timer for fs-change events
  const fsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reload active file if it changes on disk
  useAppEvent('fs-change', (data: { event: string; path: string }) => {
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
          const textStatus = await window.aynite.checkIsTextFile(activePath)
          setIsText(textStatus)
          if (textStatus) {
            const text = await window.aynite.readFile(activePath)
            setContent(text)
            setOriginalContent(text)
          }
          const info = await window.aynite.getFileInfo(activePath)
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
  })

  const handleSave = useCallback(async () => {
    if (!activePath || content === null) return
    try {
      await window.aynite.writeFile(activePath, content)
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
  }
}
