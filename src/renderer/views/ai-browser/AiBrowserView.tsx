import { useCallback, useEffect, useState } from 'react'
import { config } from '../../bridge/config'
import { AIChat } from '../aichat/AIChat'
import { FileBrowserPage } from '../file-browser/FileBrowserPage'
import { useAppEvent, useViewEvent } from '../useViewEvents'

type ViewMode = 'aichat' | 'file-browser'

export function AiBrowserView() {
  const [mode, setMode] = useState<ViewMode>('aichat')

  // Listen for session changes → switch to aichat view
  useViewEvent('active-session-changed', () => {
    setMode('aichat')
  }, [])

  // Listen for active file changes → switch to file-browser view
  useViewEvent(
    'active-file-changed',
    (data: { path: string }) => {
      if (data?.path) {
        setMode('file-browser')
      }
    },
    [],
  )

  // Listen for folder-open requests → switch to file-browser view
  useAppEvent(
    'open-folder-in-finder',
    (data: { path?: string }) => {
      if (data?.path) {
        setMode('file-browser')
      }
    },
    [],
  )

  // On mount, prefer chat view if there's an active session,
  // otherwise fall back to file-browser if there's an active file
  const checkInitialMode = useCallback(async () => {
    try {
      const [activeSessionId, activeFile] = await Promise.all([
        config.get('activeSessionId'),
        config.get('activeFile'),
      ])
      if (activeSessionId) {
        setMode('aichat')
      } else if (activeFile) {
        setMode('file-browser')
      }
    } catch (_e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    checkInitialMode()
  }, [checkInitialMode])

  if (mode === 'file-browser') {
    return <FileBrowserPage />
  }

  return <AIChat />
}
