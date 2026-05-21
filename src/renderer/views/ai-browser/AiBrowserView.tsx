import { useCallback, useEffect, useState } from 'react'
import { AIChat } from '../aichat/AIChat'
import { FileBrowserPage } from '../file-browser/FileBrowserPage'
import { useAppEvent } from '../ViewContext'

type ViewMode = 'aichat' | 'file-browser'

export function AiBrowserView() {
  const [mode, setMode] = useState<ViewMode>('aichat')

  // Listen for session changes → switch to aichat view
  useAppEvent('active-session-changed', () => {
    setMode('aichat')
  }, [])

  // Listen for active file changes → switch to file-browser view
  useAppEvent(
    'active-file-changed',
    (data: { path: string }) => {
      if (data?.path) {
        setMode('file-browser')
      }
    },
    [],
  )

  // On mount, check if there's an active file already — if so, show file-browser
  const checkInitialMode = useCallback(async () => {
    try {
      const activeFile = await window.aynite.getConfig('activeFile')
      if (activeFile) {
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
