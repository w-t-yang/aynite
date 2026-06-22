import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../../bridge/config'
import { AIChat } from '../aichat/AIChat'
import { FileBrowserPage } from '../file-browser/FileBrowserPage'
import { useAppEventSubscriber } from '../useViewEvents'

type ViewMode = 'aichat' | 'file-browser'

export function AiBrowserView() {
  const [mode, setMode] = useState<ViewMode>('aichat')
  const [pendingFolder, setPendingFolder] = useState<string | null>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  // ── Single event subscriber (per RFC-003) ──────────────────────────
  const subscribe = useAppEventSubscriber()
  useEffect(() => {
    const unsub = subscribe((event: any) => {
      switch (event.type) {
        case 'active-session-changed':
          setMode('aichat')
          setPendingFolder(null)
          break
        case 'active-file-changed':
          if (event.data?.path) {
            setMode('file-browser')
            setPendingFolder(null)
          }
          break
        case 'open-folder-in-finder':
          if (event.data?.path) {
            setPendingFolder(event.data.path)
            setMode('file-browser')
          }
          break
      }
    })
    return unsub
  }, [subscribe])

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
    return <FileBrowserPage initialBrowsingFolder={pendingFolder} />
  }

  return <AIChat />
}
