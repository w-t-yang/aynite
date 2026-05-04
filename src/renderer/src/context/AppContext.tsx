import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode
} from 'react'
import { WorkspaceConfig, LayoutNode, LeafNode } from '../../../lib/constants/types'
import { ViewRequest } from '../../../lib/constants/view'
import { ConfigKey } from '../../../lib/constants/config'
import { ayniteConfig } from '../config'
import { executeLayoutOperation } from '../utils/tile'
import { viewManager } from '../view-manager'

interface AppContextType {
  workspaceConfig: WorkspaceConfig | null
  workspaces: string[]
  activeTileId: string | null
  isResizing: boolean

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
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig | null>(null)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [activeTileId, setActiveTileId] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  const loadData = useCallback(() => {
    if (!window.aynite) {
      console.error('CRITICAL: Aynite Electron API not found.')
      return
    }
    Promise.all([ayniteConfig.getWorkspaces(), ayniteConfig.getActiveWorkspace()]).then(
      ([workspaceList, activeId]) => {
        const activeWorkspace = workspaceList.find((w) => w.id === activeId)
        if (activeWorkspace) {
          setWorkspaceConfig(activeWorkspace)
        }
        setWorkspaces(workspaceList.map((w) => w.id))
      }
    )
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const switchWorkspace = useCallback(
    (id: string) => {
      ayniteConfig.setActiveWorkspace(id).then(() => {
        loadData()
      })
    },
    [loadData]
  )

  const addWorkspace = useCallback(
    (name: string) => {
      ayniteConfig.setActiveWorkspace(name).then(() => {
        loadData()
      })
    },
    [loadData]
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
        const newConfig = {
          ...prev,
          layouts: prev.layouts.map((l) =>
            l.id === prev.activeLayoutId ? { ...l, layout: newLayout } : l
          )
        }
        if (!isResizing) ayniteConfig.saveWorkspace(newConfig)
        return newConfig
      })
    },
    [isResizing]
  )

  const updateTileView = useCallback((nodeId: string, updates: Partial<LeafNode>) => {
    const updateNodeTree = (node: LayoutNode): LayoutNode => {
      if (node.id === nodeId && node.type === 'leaf') return { ...node, ...updates }
      if (node.type === 'split') return { ...node, children: node.children.map(updateNodeTree) }
      return node
    }

    setWorkspaceConfig((prev) => {
      if (!prev) return null
      const activeLayout = prev.layouts.find((l) => l.id === prev.activeLayoutId)
      if (!activeLayout) return prev
      const newLayout = updateNodeTree(activeLayout.layout)
      const newConfig = {
        ...prev,
        layouts: prev.layouts.map((l) =>
          l.id === prev.activeLayoutId ? { ...l, layout: newLayout } : l
        )
      }
      ayniteConfig.saveWorkspace(newConfig)
      return newConfig
    })
  }, [])

  const executeAppOperation = useCallback(
    (operation: string) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        const activeLayout = prev.layouts.find((l) => l.id === prev.activeLayoutId)
        if (!activeLayout) return prev

        const { node: newLayoutNode, newActiveId } = executeLayoutOperation(
          activeLayout.layout,
          activeTileId,
          operation
        )

        if (newActiveId) setActiveTileId(newActiveId)
        if (newLayoutNode === activeLayout.layout) return prev

        const newConfig = {
          ...prev,
          layouts: prev.layouts.map((l) =>
            l.id === prev.activeLayoutId ? { ...l, layout: newLayoutNode } : l
          )
        }

        ayniteConfig.saveWorkspace(newConfig)
        return newConfig
      })
    },
    [activeTileId]
  )

  useEffect(() => {
    if (!window.aynite) return
    const removeListener = window.aynite.onAppOperation(executeAppOperation)
    return () => removeListener()
  }, [executeAppOperation])

  useEffect(() => {
    viewManager.registerListener(ViewRequest.SET_CONFIG, (payload) => {
      if (payload.key === ConfigKey.WORKSPACE || payload.key === ConfigKey.ACTIVE_WORKSPACE) {
        loadData()
      }
    })
  }, [loadData])

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

  const openFile = useCallback((path: string) => {
    setWorkspaceConfig((prev) => {
      if (!prev) return null
      const currentFiles = prev.files || []
      const newFiles = currentFiles.includes(path) ? currentFiles : [...currentFiles, path]
      const newConfig = {
        ...prev,
        files: newFiles,
        activeFile: path
      }
      ayniteConfig.saveWorkspace(newConfig)
      return newConfig
    })
    return true
  }, [])

  useEffect(() => {
    viewManager.registerListener(ViewRequest.OPEN_FILE, (path: string) => openFile(path))
  }, [openFile])

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
        handleResizeEnd
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
