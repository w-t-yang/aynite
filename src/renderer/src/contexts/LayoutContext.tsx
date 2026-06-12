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

  useEffect(() => {
    activeTileIdRef.current = activeTileId
  }, [activeTileId])

  const switchLayout = useCallback(
    (id: string) => {
      setWorkspaceConfig((prev) => {
        if (!prev) return null
        return { ...prev, activeLayoutId: id }
      })
    },
    [setWorkspaceConfig],
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
    [setWorkspaceConfig],
  )

  const executeAppOperation = useCallback(
    (operation: string, _payload?: unknown) => {
      switch (operation) {
        case 'REFRESH_TILE': {
          const activeTile = document.querySelector('.tile.border-primary')
          if (activeTile) {
            const iframe = activeTile.querySelector(
              'iframe',
            ) as HTMLIFrameElement | null
            if (iframe?.contentWindow) {
              try {
                iframe.contentWindow.location.reload()
              } catch {
                iframe.contentWindow.postMessage(
                  { type: 'aynite:refresh-tile' },
                  '*',
                )
              }
            }
          }
          return
        }
        case 'TOGGLE_LEFT_PANEL':
          console.log('[App] Toggle Left Panel')
          return
      }

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
    [workspaceConfig, setWorkspaceConfig],
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
