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
import { ayniteConfig } from '../../../lib/constants/renderer/config'
import type { WorkspaceConfig } from '../../../lib/constants/types'
import { getAllLeafIds } from '../utils/tile'

interface WorkspaceContextType {
  workspaceConfig: WorkspaceConfig | null
  workspaces: string[]
  loadData: () => void
  switchWorkspace: (id: string) => void
  addWorkspace: (name: string) => void
  deleteWorkspace: (name: string) => Promise<void>
  openNewWindow: () => void
  setWorkspaceConfig: (
    updater:
      | WorkspaceConfig
      | ((prev: WorkspaceConfig | null) => WorkspaceConfig | null),
  ) => void
  availableViews: { id: string; name: string }[]
  setActiveTileId: (id: string | null) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
)

export const WorkspaceProvider: React.FC<{
  children: ReactNode
  setActiveTileId: (id: string | null) => void
}> = ({ children, setActiveTileId }) => {
  const [workspaceConfig, setWorkspaceConfig] =
    useState<WorkspaceConfig | null>(null)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [availableViews, setAvailableViews] = useState<
    { id: string; name: string }[]
  >([])
  const loadDataRef = useRef<() => void>(() => {})

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

    ayniteConfig.getActiveFile().then((_path) => {
      // activeFile is handled by UIContext — just trigger load
    })

    if (window.aynite.getAvailableViews) {
      window.aynite.getAvailableViews().then(setAvailableViews)
    }
  }, [setActiveTileId])

  // Keep ref in sync
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  // IPC: workspace changes from other windows
  useEffect(() => {
    if (!window.aynite) return
    const unbind = window.aynite.onAppEvent((event: { type: string }) => {
      if (
        event.type === AppEvents.WORKSPACE_CHANGED ||
        event.type === AppEvents.WORKSPACE_UPDATED
      ) {
        loadDataRef.current()
      }
    })
    return unbind
  }, [])

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

  const deleteWorkspace = useCallback(
    async (name: string) => {
      if (!window.aynite?.deleteWorkspace) return
      await window.aynite.deleteWorkspace(name)
      await loadData()
    },
    [loadData],
  )

  const openNewWindow = useCallback(() => {
    window.aynite?.openNewWindow?.()
  }, [])

  // Persistence: save workspace config when it changes (debounced by isResizing guard)
  useEffect(() => {
    if (workspaceConfig) {
      ayniteConfig.saveWorkspace(workspaceConfig)
    }
  }, [workspaceConfig])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceConfig,
        workspaces,
        availableViews,
        loadData,
        switchWorkspace,
        addWorkspace,
        deleteWorkspace,
        openNewWindow,
        setWorkspaceConfig,
        setActiveTileId,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
