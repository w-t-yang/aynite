import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { AppEvents } from '../../../lib/constants/app'

interface UIContextType {
  showTileControls: boolean
  setShowTileControls: (show: boolean) => void
  showFileSwitcher: boolean
  setShowFileSwitcher: (show: boolean) => void
  activeFile: string | null
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

  const dismissNotification = useCallback(() => setActiveNotification(null), [])

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

  // Load initial active file + listen for changes
  useEffect(() => {
    if (!window.aynite) return
    window.aynite.getConfig('activeFile').then((path: string | null) => {
      if (path) setActiveFile(path)
    })

    const unbind = window.aynite.onAppEvent(
      (event: { type: string; data: any }) => {
        if (event.type === AppEvents.ACTIVE_FILE_CHANGED && event.data) {
          setActiveFile((event.data as any).path || (event.data as string))
        }
      },
    )
    return unbind
  }, [])

  return (
    <UIContext.Provider
      value={{
        showTileControls,
        setShowTileControls,
        showFileSwitcher,
        setShowFileSwitcher,
        activeFile,
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
