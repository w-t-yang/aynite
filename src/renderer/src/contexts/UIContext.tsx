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

interface UIContextType {
  showTileControls: boolean
  setShowTileControls: (show: boolean) => void
  showFileSwitcher: boolean
  setShowFileSwitcher: (show: boolean) => void
  activeFile: string | null
  /** Set active file via bridge — ACTIVE_FILE_CHANGED event will update state */
  setActiveFile: (path: string) => Promise<void>
  showSettings: boolean
  settingsTab: string | null
  setShowSettings: (show: boolean, tab?: string) => void
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
}> = ({ children, layoutExecuteAppOperation }) => {
  const [showTileControls, setShowTileControls] = useState(false)
  const [showFileSwitcher, setShowFileSwitcher] = useState(false)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<string | null>(null)

  const [activeNotification, setActiveNotification] = useState<{
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
  } | null>(null)

  const actionsRef = useRef<UIActions | null>(null)

  const dismissNotification = useCallback(() => setActiveNotification(null), [])

  const setActiveFileViaBridge = useCallback(async (path: string) => {
    await configMutations.set('activeFile', path)
    // ACTIVE_FILE_CHANGED event will update activeFile state via AppContext router
  }, [])

  const executeAppOperation = useCallback(
    (operation: string, payload?: unknown) => {
      switch (operation) {
        case 'SWITCH_FILE':
          setShowFileSwitcher((prev) => !prev)
          return
        case 'SHOW_NOTIFICATION':
          setActiveNotification(payload as any)
          setTimeout(() => setActiveNotification(null), 5000)
          return
        case 'SETTINGS':
          if (payload && (payload as any).tab) {
            setSettingsTab((payload as any).tab)
            setShowSettings(true)
          } else {
            setShowSettings((prev) => {
              const next = !prev
              if (!next) setSettingsTab(null)
              return next
            })
          }
          return
        default:
          // Delegate to layout context for tile operations
          layoutExecuteAppOperation(operation, payload)
      }
    },
    [layoutExecuteAppOperation],
  )

  // Keep actions ref in sync so AppContext can call it
  useEffect(() => {
    actionsRef.current = { setActiveFile }
  }, [])

  // Load initial active file
  useEffect(() => {
    config
      .get('activeFile')
      .then((path: string | null) => {
        if (path) setActiveFile(path)
      })
      .catch(() => {})
  }, [])

  return (
    <UIContext.Provider
      value={{
        showTileControls,
        setShowTileControls,
        showFileSwitcher,
        setShowFileSwitcher,
        activeFile,
        setActiveFile: setActiveFileViaBridge,
        showSettings,
        settingsTab,
        setShowSettings: (show: boolean, tab?: string) => {
          setShowSettings(show)
          if (tab) setSettingsTab(tab)
          else if (!show) setSettingsTab(null)
        },
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
