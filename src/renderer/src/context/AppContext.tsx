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
import { AppEvents } from '../../../lib/constants/app'
import type {
  LayoutNode,
  LeafNode,
  Theme,
  WorkspaceConfig,
} from '../../../lib/constants/types'
import { applyThemeColors } from '../../shared/lib/utils'
import { ayniteConfig } from '../config'
import { executeLayoutOperation, getAllLeafIds } from '../utils/tile'

function updateLayoutInConfig(
  prev: WorkspaceConfig,
  newLayout: LayoutNode,
): WorkspaceConfig {
  return {
    ...prev,
    layouts: prev.layouts.map((l) =>
      l.id === prev.activeLayoutId ? { ...l, layout: newLayout } : l,
    ),
  }
}

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

  // Theme support
  themes: Theme[]
  activeTheme: Theme | null
  setTheme: (themeId: string) => Promise<void>
  subscribeToAppEvents: (callback: (event: any) => void) => () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
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

  const eventListenersRef = useRef<Set<(event: any) => void>>(new Set())

  const subscribeToAppEvents = useCallback((callback: (event: any) => void) => {
    eventListenersRef.current.add(callback)
    return () => eventListenersRef.current.delete(callback)
  }, [])

  const loadThemes = useCallback(async () => {
    const loadedThemes = await ayniteConfig.getThemes()
    setThemes(loadedThemes)

    const themeId = await ayniteConfig.getActiveThemeId()
    const theme = await ayniteConfig.getTheme(themeId)
    if (theme) {
      setActiveTheme(theme)
      applyThemeColors(theme)
    }
  }, [])

  const setTheme = useCallback(
    async (themeId: string) => {
      await window.aynite.setConfig('activeTheme', themeId)
      await loadThemes()
    },
    [loadThemes],
  )

  const activeTileIdRef = useRef(activeTileId)
  useEffect(() => {
    activeTileIdRef.current = activeTileId
  }, [activeTileId])

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

    if (window.aynite.getAvailableViews) {
      window.aynite.getAvailableViews().then(setAvailableViews)
    }
    loadThemes()
  }, [loadThemes])

  useEffect(() => {
    loadData()
  }, [loadData])

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

  const switchLayout = useCallback((id: string) => {
    setWorkspaceConfig((prev) => {
      if (!prev) return null
      const newConfig = { ...prev, activeLayoutId: id }
      ayniteConfig.saveWorkspace(newConfig)
      return newConfig
    })
  }, [])

  const updateLayout = useCallback(
    (newLayout: LayoutNode) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        const newConfig = updateLayoutInConfig(prev, newLayout)
        if (!isResizing) ayniteConfig.saveWorkspace(newConfig)
        return newConfig
      })
    },
    [isResizing],
  )

  const updateTileView = useCallback(
    (nodeId: string, updates: Partial<LeafNode>) => {
      const updateNodeTree = (node: LayoutNode): LayoutNode => {
        if (node.id === nodeId && node.type === 'leaf')
          return { ...node, ...updates }
        if (node.type === 'split')
          return { ...node, children: node.children.map(updateNodeTree) }
        return node
      }

      setWorkspaceConfig((prev) => {
        if (!prev) return null
        console.log(`[AppContext] updateTileView: finding node ${nodeId}`)
        const activeLayout = prev.layouts.find(
          (l) => l.id === prev.activeLayoutId,
        )
        if (!activeLayout) return prev
        const newLayout = updateNodeTree(activeLayout.layout)
        const newConfig = updateLayoutInConfig(prev, newLayout)
        // ayniteConfig.saveWorkspace(newConfig)
        return newConfig
      })
    },
    [],
  )

  useEffect(() => {
    if (workspaceConfig && !isResizing) {
      ayniteConfig.saveWorkspace(workspaceConfig)
    }
  }, [workspaceConfig, isResizing])

  const executeAppOperation = useCallback((operation: string) => {
    setWorkspaceConfig((prev) => {
      if (!prev) return null
      const activeLayout = prev.layouts.find(
        (l) => l.id === prev.activeLayoutId,
      )
      if (!activeLayout) return prev

      const { node: newLayoutNode, newActiveId } = executeLayoutOperation(
        activeLayout.layout,
        activeTileIdRef.current,
        operation,
      )

      if (newActiveId) setActiveTileId(newActiveId)
      if (newLayoutNode === activeLayout.layout) return prev

      const newConfig = {
        ...prev,
        layouts: prev.layouts.map((l) =>
          l.id === prev.activeLayoutId ? { ...l, layout: newLayoutNode } : l,
        ),
      }

      ayniteConfig.saveWorkspace(newConfig)
      return newConfig
    })
  }, [])

  useEffect(() => {
    if (!window.aynite) return
    // Listen for app operations (layout, etc.)
    return window.aynite.onAppOperation(executeAppOperation)
  }, [executeAppOperation])

  useEffect(() => {
    if (!window.aynite) return

    // Listen for broadcast events and relay to iframes
    return window.aynite.onAppEvent(
      (event: { type: string; data: unknown }) => {
        // 1. Notify local subscribers
        for (const listener of eventListenersRef.current) {
          listener(event)
        }

        // 2. Relay to all iframes
        for (const iframe of document.querySelectorAll<HTMLIFrameElement>(
          'iframe',
        )) {
          iframe.contentWindow?.postMessage(
            { type: `aynite:${event.type}`, data: event.data },
            '*',
          )
        }

        // 3. Local reactions to app events
        if (event.type === AppEvents.CONFIG_ERROR) {
          console.error('[App] Config Error:', event.data)
        } else if (event.type === AppEvents.THEME_CHANGED) {
          loadThemes()
        } else if (event.type === AppEvents.WORKSPACE_CHANGED) {
          window.aynite.refreshWatcher()
        } else if (event.type === AppEvents.FILE_RENAMED) {
          const { oldPath: _oldPath, newPath: _newPath } = event.data as {
            oldPath: string
            newPath: string
          }
          // TODO: Implement workspace folder rename in bridge if needed
        } else if (event.type === AppEvents.FILE_DELETED) {
          const { path } = event.data as { path: string }
          window.aynite.removeWorkspaceFolder(path)
        }
      },
    )
  }, [loadThemes])

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

  const _openFile = useCallback((path: string) => {
    setWorkspaceConfig((prev) => {
      if (!prev) return null
      const currentFiles = prev.files || []
      const newFiles = currentFiles.includes(path)
        ? currentFiles
        : [...currentFiles, path]
      const newConfig = {
        ...prev,
        files: newFiles,
        activeFile: path,
      }
      ayniteConfig.saveWorkspace(newConfig)
      return newConfig
    })
    return true
  }, [])

  // Expose context to window for debugging in development
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
        subscribeToAppEvents,
        themes,
        activeTheme,
        setTheme,
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
