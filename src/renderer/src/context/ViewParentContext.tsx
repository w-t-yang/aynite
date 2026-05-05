import React, { createContext, useContext, useEffect, useCallback, ReactNode, RefObject } from 'react'
import {
  ViewRequest,
  ViewResponseDTO,
  ViewOperationDTO,
  AYNITE_VIEW_REQUEST,
  AYNITE_VIEW_RESPONSE,
  AYNITE_VIEW_OPERATION,
  AYNITE_EVENT_THEME_CHANGED,
  AYNITE_EVENT_ACTIVE_FILE_CHANGED
} from '../../../lib/constants/view'
import { PROTOCOL } from '../../../lib/constants/app'
import { viewManager } from '../view-manager'
import { useApp } from './AppContext'
import { useTheme } from './ThemeContext'

interface ViewParentContextType {
  iframeRef: RefObject<HTMLIFrameElement | null>
  notify: (operation: string, params?: any) => void
}

const ViewParentContext = createContext<ViewParentContextType | undefined>(undefined)

export const ViewParentProvider: React.FC<{ 
  id: string, 
  iframeRef: RefObject<HTMLIFrameElement | null>, 
  children: ReactNode 
}> = ({ id, iframeRef, children }) => {
  const { setActiveTileId, workspaceConfig } = useApp()
  const { activeTheme } = useTheme()

  /**
   * Send a broadcast operation to the micro-app
   */
  const notify = useCallback((operation: string, params?: any) => {
    if (!iframeRef.current?.contentWindow) return
    
    iframeRef.current.contentWindow.postMessage(
      {
        type: AYNITE_VIEW_OPERATION,
        operation,
        params
      } as ViewOperationDTO,
      '*'
    )
  }, [iframeRef])

  // --- 2. Automatic State Syncing (Theme & Workspace) ---
  const sync = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // 1. Direct Theme Injection (CSS Variables)
    if (activeTheme && iframe.contentDocument) {
      const root = iframe.contentDocument.documentElement
      for (const [key, value] of Object.entries(activeTheme.colors)) {
        const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase()
        root.style.setProperty(cssVar, value as string)
      }
      root.setAttribute('data-theme', activeTheme.type)
      
      if (activeTheme.fonts) {
        if (activeTheme.fonts.fontFamily) root.style.setProperty('--font-sans', activeTheme.fonts.fontFamily)
        if (activeTheme.fonts.fontSize) {
          root.style.setProperty('--font-size-base', activeTheme.fonts.fontSize)
          root.style.fontSize = activeTheme.fonts.fontSize
        }
      }
    }

    // 2. Message-based State Notification (for JS logic inside iframes)
    if (activeTheme) notify(AYNITE_EVENT_THEME_CHANGED, { theme: activeTheme })
    if (workspaceConfig) {
      notify(AYNITE_EVENT_ACTIVE_FILE_CHANGED, { 
        active_file: workspaceConfig.activeFile,
        workspace: workspaceConfig 
      })
    }
  }, [activeTheme, workspaceConfig, notify, iframeRef])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Security & Target Check
      if (event.source !== iframeRef.current?.contentWindow) return
      
      const isAllowedOrigin =
        event.origin === `${PROTOCOL}://` ||
        event.origin === 'null' ||
        event.origin.startsWith(`${PROTOCOL}:`)
      if (!isAllowedOrigin) return

      const { type, id: msgId, method, payload, operation } = event.data || {}

      // 2. High-priority Platform Triggers (Focus)
      if (method === ViewRequest.TILE_FOCUS || method === ViewRequest.KEYBOARD_EVENT) {
        setActiveTileId(id)
        return
      }

      // 3. Generic Request-Response Handling
      if (type === AYNITE_VIEW_REQUEST) {
        viewManager
          .handleRequest(method, payload)
          .then((result) => {
            if (!iframeRef.current?.contentWindow) return
            iframeRef.current.contentWindow.postMessage(
              { type: AYNITE_VIEW_RESPONSE, id: msgId, result } as ViewResponseDTO,
              '*'
            )
          })
          .catch((error) => {
            if (!iframeRef.current?.contentWindow) return
            iframeRef.current.contentWindow.postMessage(
              { type: AYNITE_VIEW_RESPONSE, id: msgId, error: error.message } as ViewResponseDTO,
              '*'
            )
          })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.addEventListener('message', handleMessage)
  }, [id, setActiveTileId, iframeRef])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      // Small delay to ensure the document is fully ready for style manipulation
      setTimeout(() => sync(), 50)
    }
    
    // 1. Initial sync attempt (in case it's already loaded or starting to load)
    sync()

    // 2. Load-time sync
    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [iframeRef, sync])

  useEffect(() => {
    sync()
  }, [activeTheme, workspaceConfig, sync])

  return (
    <ViewParentContext.Provider value={{ iframeRef, notify }}>
      {children}
    </ViewParentContext.Provider>
  )
}

export const useViewParent = () => {
  const context = useContext(ViewParentContext)
  if (!context) throw new Error('useViewParent must be used within a ViewParentProvider')
  return context
}
