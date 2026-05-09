import type React from 'react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AppEvents } from '../../lib/constants/app'
import { ayniteConfig } from '../../lib/constants/renderer/config'
import type {
  LayoutNode,
  LeafNode,
  Theme,
  WorkspaceConfig,
} from '../../lib/constants/types'
import type { UpdateStatus } from '../../lib/types/app'
import { applyThemeColors } from '../shared/lib/utils'
import {
  executeLayoutOperation,
  getAllLeafIds,
  updateLayoutInConfig,
  updateNodeInLayout,
} from './utils/tile'

// --- Context Type ---

interface AppContextType {
  workspaceConfig: WorkspaceConfig | null
  workspaces: string[]
  activeTileId: string | null
  isResizing: boolean
  availableViews: { id: string; name: string }[]

  setActiveTileId: (id: string | null) => void

  loadData: () => void
  switchWorkspace: (id: string) => void
  addWorkspace: (name: string) => void
  switchLayout: (id: string) => void
  updateLayout: (newLayout: LayoutNode) => void
  updateTileView: (nodeId: string, updates: Partial<LeafNode>) => void
  executeAppOperation: (operation: string) => void

  handleResizeStart: () => void
  handleResizeEnd: () => void

  themes: Theme[]
  activeTheme: Theme | null
  setTheme: (themeId: string) => Promise<void>

  // Update State
  updateStatus: UpdateStatus
  updateInfo: any
  updateProgress: number
  updateError: string | null
  setUpdateStatus: (status: UpdateStatus) => void

  showTileControls: boolean
  setShowTileControls: (show: boolean) => void

  showFileSwitcher: boolean
  setShowFileSwitcher: (show: boolean) => void

  activeFile: string | null

  showSettings: boolean
  setShowSettings: (show: boolean) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// --- Provider ---

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // 1. State definitions
  const [workspaceConfig, setWorkspaceConfig] =
    useState<WorkspaceConfig | null>(null)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [activeTileId, setActiveTileId] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [availableViews, setAvailableViews] = useState<
    { id: string; name: string }[]
  >([])

  const [themes, setThemes] = useState<Theme[]>([])
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null)

  // Update State
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateProgress, setUpdateProgress] = useState<number>(0)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const [showTileControls, setShowTileControls] = useState(false)
  const [showFileSwitcher, setShowFileSwitcher] = useState(false)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const activeTileIdRef = useRef(activeTileId)

  // Sync ref for access in async callbacks
  useEffect(() => {
    activeTileIdRef.current = activeTileId
  }, [activeTileId])

  // 2. Theme Management (Reactive)

  // Side Effect: "Paint" the app whenever the activeTheme state changes
  useEffect(() => {
    if (activeTheme) {
      applyThemeColors(activeTheme)
    }
  }, [activeTheme])

  const refreshThemes = useCallback(async () => {
    const loadedThemes = await ayniteConfig.getThemes()
    setThemes(loadedThemes)

    const themeId = await ayniteConfig.getActiveThemeId()
    const theme = await ayniteConfig.getTheme(themeId)

    if (theme) {
      setActiveTheme(theme)
    }
  }, [])

  // 3. Core Data Sync
  const loadData = useCallback(() => {
    if (!window.aynite) {
      console.error('CRITICAL: Aynite Electron API not found.')
      return
    }
    Promise.all([
      ayniteConfig.getWorkspaces(),
      ayniteConfig.getActiveWorkspace(),
    ]).then(([workspaceList, activeId]) => {
      const activeWorkspace = workspaceList.find((w) => w.id === activeId)
      if (activeWorkspace) {
        setWorkspaceConfig(activeWorkspace)
        const activeLayout = activeWorkspace.layouts.find(
          (l) => l.id === activeWorkspace.activeLayoutId,
        )
        if (activeLayout) {
          const leafIds = getAllLeafIds(activeLayout.layout)
          if (leafIds.length > 0) {
            setActiveTileId((prev) => prev || leafIds[0])
          }
        }
      }
      setWorkspaces(workspaceList.map((w) => w.id))
    })

    ayniteConfig.getActiveFile().then(setActiveFile)

    if (window.aynite.getAvailableViews) {
      window.aynite.getAvailableViews().then(setAvailableViews)
    }
    refreshThemes()
  }, [refreshThemes])

  useEffect(() => {
    loadData()
  }, [loadData])

  const setTheme = useCallback(
    async (themeId: string) => {
      await window.aynite.setConfig('activeTheme', themeId)
      await refreshThemes()
    },
    [refreshThemes],
  )

  // 4. Workspace Management
  const switchWorkspace = useCallback(
    (id: string) => {
      ayniteConfig.setActiveWorkspace(id).then(() => {
        loadData()
      })
    },
    [loadData],
  )

  const addWorkspace = useCallback(
    (name: string) => {
      ayniteConfig.createWorkspace(name).then(() => {
        loadData()
      })
    },
    [loadData],
  )

  // 5. Layout & Tile Management
  const switchLayout = useCallback((id: string) => {
    setWorkspaceConfig((prev) => {
      if (!prev) return null
      return { ...prev, activeLayoutId: id }
    })
  }, [])

  const updateLayout = useCallback((newLayout: LayoutNode) => {
    setWorkspaceConfig((prev) => {
      if (!prev) return null
      return updateLayoutInConfig(prev, newLayout)
    })
  }, [])

  const updateTileView = useCallback(
    (nodeId: string, updates: Partial<LeafNode>) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        const activeLayout = prev.layouts.find(
          (l) => l.id === prev.activeLayoutId,
        )
        if (!activeLayout) return prev
        const newLayout = updateNodeInLayout(
          activeLayout.layout,
          nodeId,
          updates,
        )
        return updateLayoutInConfig(prev, newLayout)
      })
    },
    [],
  )

  const executeAppOperation = useCallback(
    (operation: string) => {
      // 1. Handle Global/Non-Layout Operations
      switch (operation) {
        case 'REFRESH_APP':
          window.location.reload()
          return
        case 'TOGGLE_LEFT_PANEL':
          // We could add state for panels here later
          console.log('[App] Toggle Left Panel')
          return
        case 'SWITCH_FILE':
          setShowFileSwitcher((prev) => !prev)
          return
        case 'SETTINGS':
          setShowSettings((prev) => !prev)
          return
        // Add other global cases as needed...
      }

      // 2. Handle Layout/Tile Operations
      if (!workspaceConfig) return
      const activeLayout = workspaceConfig.layouts.find(
        (l) => l.id === workspaceConfig.activeLayoutId,
      )
      if (!activeLayout) return

      const { node: newLayoutNode, newActiveId } = executeLayoutOperation(
        activeLayout.layout,
        activeTileIdRef.current,
        operation,
      )

      if (newActiveId) setActiveTileId(newActiveId)

      if (newLayoutNode !== activeLayout.layout) {
        setWorkspaceConfig(updateLayoutInConfig(workspaceConfig, newLayoutNode))
      }
    },
    [workspaceConfig],
  )

  // 6. IPC Event & Operation Handling
  const handlersRef = useRef({ refreshThemes, loadData, executeAppOperation })
  useEffect(() => {
    handlersRef.current = { refreshThemes, loadData, executeAppOperation }
  }, [refreshThemes, loadData, executeAppOperation])

  useEffect(() => {
    if (!window.aynite) return

    const unbindEvent = window.aynite.onAppEvent(
      (event: { type: string; data: any }) => {
        // 1. Relay to all iframes
        for (const iframe of document.querySelectorAll<HTMLIFrameElement>(
          'iframe',
        )) {
          iframe.contentWindow?.postMessage(
            { type: `aynite:${event.type}`, data: event.data },
            '*',
          )
        }

        // 2. Core Reactions to System Events (using latest handlers from ref)
        const { refreshThemes: rt, loadData: ld } = handlersRef.current

        switch (event.type) {
          case AppEvents.CONFIG_ERROR:
            console.error('[App] Config Error:', event.data)
            break
          case AppEvents.THEME_CHANGED:
            rt()
            break
          case AppEvents.WORKSPACE_CHANGED:
            ld()
            break
          case AppEvents.WORKSPACE_UPDATED:
            ld()
            break
          case AppEvents.ACTIVE_FILE_CHANGED:
            if (event.data)
              setActiveFile((event.data as any).path || (event.data as string))
            break
          case AppEvents.TILE_ACTIVATED:
            if (event.data) setActiveTileId(event.data as string)
            break

          // --- Release/Update Events ---
          case AppEvents.UPDATE_CHECKING:
            setUpdateStatus('checking')
            break
          case AppEvents.UPDATE_AVAILABLE:
            setUpdateStatus('available')
            setUpdateInfo(event.data)
            break
          case AppEvents.UPDATE_NOT_AVAILABLE:
            setUpdateStatus('idle')
            break
          case AppEvents.UPDATE_ERROR:
            setUpdateStatus('error')
            setUpdateError(event.data)
            break
          case AppEvents.UPDATE_PROGRESS:
            setUpdateStatus('downloading')
            setUpdateProgress(event.data.percent)
            break
          case AppEvents.UPDATE_DOWNLOADED:
            setUpdateStatus('downloaded')
            setUpdateInfo(event.data)
            break
        }
      },
    )

    const unbindOp = window.aynite.onAppOperation((op: string) => {
      handlersRef.current.executeAppOperation(op)
    })

    return () => {
      unbindEvent()
      unbindOp()
    }
  }, [])

  // Listen for messages from iframes (views)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data
      if (msg?.type === 'aynite:operation' && msg.operation) {
        executeAppOperation(msg.operation, msg.data)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [executeAppOperation])

  // Persistence
  useEffect(() => {
    if (workspaceConfig && !isResizing) {
      ayniteConfig.saveWorkspace(workspaceConfig)
    }
  }, [workspaceConfig, isResizing])

  // 7. UI Helpers
  const handleResizeStart = useCallback(() => {
    setIsResizing(true)
    document.body.classList.add('is-resizing')
  }, [])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    document.body.classList.remove('is-resizing')
    setWorkspaceConfig((latest) => {
      if (latest) ayniteConfig.saveWorkspace(latest)
      return latest
    })
  }, [])

  // 8. Debugging
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as any).__aynite_context = {
        workspaceConfig,
        workspaces,
        activeTileId,
        isResizing,
        setActiveTileId,
        loadData,
        switchWorkspace,
        addWorkspace,
        switchLayout,
        updateLayout,
        updateTileView,
        executeAppOperation,
        handleResizeStart,
        handleResizeEnd,
        themes,
        activeTheme,
        setTheme,
        updateStatus,
        updateInfo,
        updateProgress,
      }
    }
  }, [
    workspaceConfig,
    workspaces,
    activeTileId,
    isResizing,
    loadData,
    switchWorkspace,
    addWorkspace,
    switchLayout,
    updateLayout,
    updateTileView,
    executeAppOperation,
    handleResizeStart,
    handleResizeEnd,
    themes,
    setTheme,
    activeTheme,
    updateStatus,
    updateInfo,
    updateProgress,
  ])

  return (
    <AppContext.Provider
      value={{
        workspaceConfig,
        workspaces,
        activeTileId,
        isResizing,
        setActiveTileId,
        loadData,
        switchWorkspace,
        addWorkspace,
        switchLayout,
        updateLayout,
        updateTileView,
        executeAppOperation,
        handleResizeStart,
        handleResizeEnd,
        availableViews,
        themes,
        activeTheme,
        setTheme,
        updateStatus,
        updateInfo,
        updateProgress,
        updateError,
        setUpdateStatus,
        showTileControls,
        setShowTileControls,
        showFileSwitcher,
        setShowFileSwitcher,
        activeFile,
        showSettings,
        setShowSettings,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
