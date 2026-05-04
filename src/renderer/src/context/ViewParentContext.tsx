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

  // --- 1. Handle Incoming Requests from Iframe ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Security & Target Check
      if (event.source !== iframeRef.current?.contentWindow) return
      
      const isAllowedOrigin =
        event.origin === `${PROTOCOL}://` ||
        event.origin === 'null' ||
        event.origin.startsWith(`${PROTOCOL}:`)
      if (!isAllowedOrigin) return

      const { type, id: msgId, method, payload } = event.data || {}

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

  // --- 2. Automatic State Syncing (Theme & Workspace) ---
  const sync = useCallback(() => {
    if (activeTheme) notify(AYNITE_EVENT_THEME_CHANGED, { theme: activeTheme })
    if (workspaceConfig) {
      notify(AYNITE_EVENT_ACTIVE_FILE_CHANGED, { 
        active_file: workspaceConfig.activeFile,
        workspace: workspaceConfig 
      })
    }
  }, [activeTheme, workspaceConfig, notify])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => sync()
    iframe.addEventListener('load', handleLoad)
    return () => iframe.removeEventListener('load', handleLoad)
  }, [iframeRef, sync])

  useEffect(() => {
    if (activeTheme) notify(AYNITE_EVENT_THEME_CHANGED, { theme: activeTheme })
  }, [activeTheme, notify])

  useEffect(() => {
    if (workspaceConfig) {
      notify(AYNITE_EVENT_ACTIVE_FILE_CHANGED, { 
        active_file: workspaceConfig.activeFile,
        workspace: workspaceConfig 
      })
    }
  }, [workspaceConfig, notify])

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
