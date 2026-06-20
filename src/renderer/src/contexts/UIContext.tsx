import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { UIActions } from '../../../lib/types/ui'
import { config, configMutations } from '../../bridge/config'
import { useWorkspace } from './WorkspaceContext'

interface UIContextType {
  showTileControls: boolean
  setShowTileControls: (show: boolean) => void
  showFileSwitcher: boolean
  setShowFileSwitcher: (show: boolean) => void
  activeFile: string | null
  /** Set active file via bridge — ACTIVE_FILE_CHANGED event will update state */
  setActiveFile: (path: string) => Promise<void>
  activeNotification: {
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
  } | null
  dismissNotification: () => void
  executeAppOperation: (operation: string, payload?: unknown) => void
  /** Exposed so AppContext single router can call event-driven updates */
  actionsRef: React.MutableRefObject<UIActions | null>
}

const UIContext = createContext<UIContextType | undefined>(undefined)

export const UIProvider: React.FC<{
  children: ReactNode
  layoutExecuteAppOperation: (operation: string, payload?: unknown) => void
  refreshTile: () => void
}> = ({ children, layoutExecuteAppOperation, refreshTile }) => {
  const [showTileControls, setShowTileControls] = useState(false)
  const [showFileSwitcher, setShowFileSwitcher] = useState(false)
  const [activeFile, setActiveFile] = useState<string | null>(null)

  const [activeNotification, setActiveNotification] = useState<{
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
  } | null>(null)

  const actionsRef = useRef<UIActions | null>(null)

  // Sync activeFile to workspaceConfig so auto-save doesn't overwrite it with stale data
  const { setWorkspaceConfig } = useWorkspace()
  const syncActiveFileToWorkspace = useCallback(
    (path: string | null) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        if (prev.activeFile === path) return prev
        return { ...prev, activeFile: path ?? undefined }
      })
    },
    [setWorkspaceConfig],
  )

  const dismissNotification = useCallback(() => setActiveNotification(null), [])

  const setActiveFileViaBridge = useCallback(async (path: string) => {
    await configMutations.set('activeFile', path)
    // ACTIVE_FILE_CHANGED event will update activeFile state via AppContext router
  }, [])

  // Override the state setter to also sync to workspace config.
  // This is called both from the event router (ACTIVE_FILE_CHANGED) and
  // from the initial load, ensuring workspaceConfig.activeFile stays in sync.
  const handleSetActiveFile = useCallback(
    (path: string | null) => {
      setActiveFile(path)
      syncActiveFileToWorkspace(path)
    },
    [syncActiveFileToWorkspace],
  )

  const executeAppOperation = useCallback(
    (operation: string, payload?: unknown) => {
      switch (operation) {
        case 'REFRESH_TILE':
          refreshTile()
          return
        case 'SWITCH_FILE':
          setShowFileSwitcher((prev) => !prev)
          return
        case 'SHOW_NOTIFICATION':
          setActiveNotification(payload as any)
          setTimeout(() => setActiveNotification(null), 5000)
          return
        default:
          // Delegate to layout context for tile operations
          layoutExecuteAppOperation(operation, payload)
      }
    },
    [layoutExecuteAppOperation, refreshTile],
  )

  // Keep actions ref in sync so AppContext can call it
  useEffect(() => {
    actionsRef.current = { setActiveFile: handleSetActiveFile }
  }, [handleSetActiveFile])

  // Load initial active file
  useEffect(() => {
    config
      .get('activeFile')
      .then((path: string | null) => {
        if (path) handleSetActiveFile(path)
      })
      .catch(() => {})
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSetActiveFile])

  return (
    <UIContext.Provider
      value={{
        showTileControls,
        setShowTileControls,
        showFileSwitcher,
        setShowFileSwitcher,
        activeFile,
        setActiveFile: setActiveFileViaBridge,
        activeNotification,
        dismissNotification,
        executeAppOperation,
        actionsRef,
      }}
    >
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUI must be used within a UIProvider')
  }
  return context
}
