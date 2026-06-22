import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { LayoutNode, LeafNode } from '../../../lib/constants/types'
import type { LayoutActions } from '../../../lib/types/ui'
import { configMutations } from '../../bridge/config'
import {
  executeLayoutOperation,
  getAllLeafIds,
  updateLayoutInConfig,
  updateNodeInLayout,
} from '../utils/tile'
import { useWorkspace } from './WorkspaceContext'

interface LayoutContextType {
  activeTileId: string | null
  isResizing: boolean
  setActiveTileId: (id: string | null) => void
  switchLayout: (id: string) => void
  addLayout: (name: string, layout: LayoutNode) => void
  removeLayout: (id: string) => void
  updateLayout: (newLayout: LayoutNode) => void
  updateTileView: (nodeId: string, updates: Partial<LeafNode>) => void
  executeAppOperation: (operation: string, payload?: unknown) => void
  handleResizeStart: () => void
  handleResizeEnd: () => void
  /** Exposed so AppContext single router can call event-driven updates */
  actionsRef: React.MutableRefObject<LayoutActions | null>
  /** Navigation history */
  navHistory: string[]
  navIndex: number
  navigateBack: () => void
  navigateForward: () => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // Read workspace state from WorkspaceContext (must be nested inside WorkspaceProvider)
  const { workspaceConfig, setWorkspaceConfig } = useWorkspace()

  const [activeTileId, setActiveTileId] = useState<string | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const activeTileIdRef = useRef(activeTileId)

  // Navigation history
  const [navHistory, setNavHistory] = useState<string[]>(() => {
    // Initialize with the current layout if available
    return workspaceConfig?.activeLayoutId
      ? [workspaceConfig.activeLayoutId]
      : []
  })
  const [navIndex, setNavIndex] = useState(0)

  const pushNavEntry = useCallback(
    (layoutId: string) => {
      setNavHistory((prev) => {
        // If we navigated back, truncate forward history
        const truncated = prev.slice(0, navIndex + 1)
        return [...truncated, layoutId]
      })
      setNavIndex((prev) => prev + 1)
      // navIndex dep intentionally omitted — we always append to the current position
    },
    [navIndex],
  )

  const navigateBack = useCallback(() => {
    if (navIndex <= 0) return
    const newIndex = navIndex - 1
    const layoutId = navHistory[newIndex]
    if (layoutId) {
      setNavIndex(newIndex)
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        return { ...prev, activeLayoutId: layoutId }
      })
    }
  }, [navIndex, navHistory, setWorkspaceConfig])

  const navigateForward = useCallback(() => {
    if (navIndex >= navHistory.length - 1) return
    const newIndex = navIndex + 1
    const layoutId = navHistory[newIndex]
    if (layoutId) {
      setNavIndex(newIndex)
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        return { ...prev, activeLayoutId: layoutId }
      })
    }
  }, [navIndex, navHistory, setWorkspaceConfig])

  useEffect(() => {
    activeTileIdRef.current = activeTileId
  }, [activeTileId])

  const switchLayout = useCallback(
    (id: string) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        return { ...prev, activeLayoutId: id }
      })
      // Set the first tile as active after switching layout
      if (workspaceConfig) {
        const newLayout = workspaceConfig.layouts.find((l) => l.id === id)
        if (newLayout) {
          const leafIds = getAllLeafIds(newLayout.layout)
          if (leafIds.length > 0) {
            setActiveTileId(leafIds[0])
          }
        }
      }
      pushNavEntry(id)
    },
    [setWorkspaceConfig, workspaceConfig, pushNavEntry],
  )

  const addLayout = useCallback(
    (name: string, layout: LayoutNode) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        if (prev.layouts.length >= 9) return prev
        const newLayoutId = Math.random().toString(36).slice(2, 10)
        const newLayout = { id: newLayoutId, name, layout }
        return {
          ...prev,
          layouts: [...prev.layouts, newLayout],
          activeLayoutId: newLayoutId,
        }
      })
    },
    [setWorkspaceConfig],
  )

  const removeLayout = useCallback(
    (id: string) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        const toRemove = prev.layouts.find((l) => l.id === id)
        // Cannot remove system layouts
        if (toRemove?.system) return prev
        if (prev.layouts.length <= 1) return prev
        const newLayouts = prev.layouts.filter((l) => l.id !== id)
        let newActiveId = prev.activeLayoutId
        if (prev.activeLayoutId === id) {
          newActiveId = newLayouts[0].id
        }
        return {
          ...prev,
          layouts: newLayouts,
          activeLayoutId: newActiveId,
        }
      })
    },
    [setWorkspaceConfig],
  )

  const updateLayout = useCallback(
    (newLayout: LayoutNode) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        return updateLayoutInConfig(prev, newLayout)
      })
    },
    [setWorkspaceConfig],
  )

  const updateTileView = useCallback(
    (nodeId: string, updates: Partial<LeafNode>) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        const activeLayoutEntry = prev.layouts.find(
          (l) => l.id === prev.activeLayoutId,
        )
        // Fixed layouts cannot be structurally modified
        if (activeLayoutEntry?.fixed) return prev
        if (!activeLayoutEntry) return prev
        const newLayout = updateNodeInLayout(
          activeLayoutEntry.layout,
          nodeId,
          updates,
        )
        return updateLayoutInConfig(prev, newLayout)
      })
    },
    [setWorkspaceConfig],
  )

  const executeAppOperation = useCallback(
    (operation: string, payload?: unknown) => {
      switch (operation) {
        case 'OPEN_SESSION':
          if (
            payload &&
            typeof payload === 'object' &&
            'sessionId' in (payload as any)
          ) {
            const { sessionId } = payload as { sessionId: string }
            // Update activeSessionId in the workspace config in-memory before switching
            setWorkspaceConfig((prev) => {
              if (!prev) return null
              return {
                ...prev,
                activeSessionId: sessionId,
                activeLayoutId: 'sys-projects',
              }
            })
            pushNavEntry('sys-projects')
          }
          return
        case 'SET_SESSION':
          if (
            payload &&
            typeof payload === 'object' &&
            'sessionId' in (payload as any)
          ) {
            const { sessionId } = payload as { sessionId: string }
            setWorkspaceConfig((prev) => {
              if (!prev) return null
              return { ...prev, activeSessionId: sessionId }
            })
          }
          return
        case 'OPEN_AGENT_SETTINGS':
          if (
            payload &&
            typeof payload === 'object' &&
            'agentId' in (payload as any)
          ) {
            const { agentId } = payload as { agentId: string }
            setWorkspaceConfig((prev) => {
              if (!prev) return null
              return {
                ...prev,
                activeLayoutId: 'sys-settings',
              }
            })
            pushNavEntry('sys-settings')
            window.history.replaceState(null, '', `#tab=agent-${agentId}`)
            window.dispatchEvent(new HashChangeEvent('hashchange'))
          }
          return
        case 'OPEN_SKILLS_SETTINGS':
          setWorkspaceConfig((prev) => {
            if (!prev) return null
            return { ...prev, activeLayoutId: 'sys-settings' }
          })
          pushNavEntry('sys-settings')
          window.history.replaceState(null, '', '#tab=skills')
          window.dispatchEvent(new HashChangeEvent('hashchange'))
          return
        case 'SWITCH_LAYOUT':
          if (payload && typeof payload === 'string') {
            switchLayout(payload)
          }
          return
        case 'TOGGLE_LEFT_PANEL':
          console.log('[App] Toggle Left Panel')
          return
      }

      if (!workspaceConfig) return
      const activeLayout = workspaceConfig.layouts.find(
        (l) => l.id === workspaceConfig.activeLayoutId,
      )
      if (!activeLayout) return
      // Fixed layouts cannot be structurally modified
      if (activeLayout.fixed) return

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
    [workspaceConfig, setWorkspaceConfig, switchLayout, pushNavEntry],
  )

  const handleResizeStart = useCallback(() => {
    setIsResizing(true)
    document.body.classList.add('is-resizing')
  }, [])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    document.body.classList.remove('is-resizing')
    setWorkspaceConfig((latest) => {
      if (latest) {
        configMutations
          .set('workspace', { id: latest.id, config: latest })
          .catch((e) =>
            console.error('Failed to save workspace on resize end:', e),
          )
      }
      return latest
    })
  }, [setWorkspaceConfig])

  const actionsRef = useRef<LayoutActions | null>(null)

  // Keep actions ref in sync
  useEffect(() => {
    actionsRef.current = { setActiveTileId }
  }, [])

  // Register setActiveTileId with WorkspaceProvider so loadData can set it
  const { registerSetActiveTileId } = useWorkspace()
  useEffect(() => {
    registerSetActiveTileId(setActiveTileId)
  }, [registerSetActiveTileId])

  return (
    <LayoutContext.Provider
      value={{
        activeTileId,
        isResizing,
        setActiveTileId,
        switchLayout,
        addLayout,
        removeLayout,
        updateLayout,
        updateTileView,
        executeAppOperation,
        handleResizeStart,
        handleResizeEnd,
        actionsRef,
        navHistory,
        navIndex,
        navigateBack,
        navigateForward,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
}

export const useLayout = () => {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider')
  }
  return context
}
