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
  registerSetActiveTileId: (fn: (id: string | null) => void) => void
  registerRefreshThemes: (fn: () => void) => void
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
)

export const WorkspaceProvider: React.FC<{
  children: ReactNode
}> = ({ children }) => {
  const [workspaceConfig, setWorkspaceConfig] =
    useState<WorkspaceConfig | null>(null)
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [availableViews, setAvailableViews] = useState<
    { id: string; name: string }[]
  >([])
  const loadDataRef = useRef<() => void>(() => {})
  // Ref to setActiveTileId from LayoutContext — set by useSetActiveTileIdRef
  const setActiveTileIdRef = useRef<((id: string | null) => void) | null>(null)
  // Ref to refreshThemes from ThemeContext — set by registerRefreshThemes
  const refreshThemesRef = useRef<(() => void) | null>(null)

  const registerRefreshThemes = useCallback((fn: () => void) => {
    refreshThemesRef.current = fn
  }, [])

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
            setActiveTileIdRef.current?.(leafIds[0])
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

    // Refresh themes after loading workspace data
    refreshThemesRef.current?.()
  }, [])

  // Initial load on mount
  useEffect(() => {
    loadData()
  }, [loadData])

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

  const addWorkspace = useCallback((name: string) => {
    // Main process broadcasts WORKSPACE_CHANGED, IPC listener calls loadData
    ayniteConfig.createWorkspace(name)
  }, [])

  const deleteWorkspace = useCallback(async (name: string) => {
    // Main process broadcasts WORKSPACE_CHANGED, IPC listener calls loadData
    if (!window.aynite?.deleteWorkspace) return
    await window.aynite.deleteWorkspace(name)
  }, [])

  const openNewWindow = useCallback(() => {
    window.aynite?.openNewWindow?.()
  }, [])

  const registerSetActiveTileId = useCallback(
    (fn: (id: string | null) => void) => {
      setActiveTileIdRef.current = fn
    },
    [],
  )

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
        registerSetActiveTileId,
        registerRefreshThemes,
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
