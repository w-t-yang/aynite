import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { WorkspaceConfig } from '../../../lib/constants/types'
import { config, configMutations } from '../../bridge/config'
import { system as bridgeSystem, systemMutations } from '../../bridge/system'
import { workspace, workspaceMutations } from '../../bridge/workspace'
import { getAllLeafIds } from '../utils/tile'

export interface WorkspaceActions {
  loadData: () => void
}

interface WorkspaceContextType {
  workspaceConfig: WorkspaceConfig | null
  workspaces: string[]
  getAllFiles: () => Promise<
    { name: string; path: string; isDirectory: boolean }[]
  >
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
  /** Exposed so AppContext single router can call event-driven updates */
  actionsRef: React.MutableRefObject<WorkspaceActions | null>
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
  // Ref exposed to AppContext for centralized event routing
  const actionsRef = useRef<WorkspaceActions | null>(null)

  const registerRefreshThemes = useCallback((fn: () => void) => {
    refreshThemesRef.current = fn
  }, [])

  const getAllFiles = useCallback(async () => {
    return workspace.allFiles()
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [wsConfigs, activeId] = await Promise.all([
        config.get('workspaces'),
        config.get('activeWorkspace'),
      ])

      // wsConfigs is an array of WorkspaceConfig objects returned by the
      // workspaceHandlers handler for key 'workspaces'.
      const workspaceList: WorkspaceConfig[] = Array.isArray(wsConfigs)
        ? wsConfigs
        : []
      const wsId = activeId

      // Find the matching workspace config directly from the array
      const matchedConfig =
        workspaceList.length > 0
          ? workspaceList.find((w: any) => w.id === wsId) || null
          : null

      setWorkspaceConfig(matchedConfig)

      if (matchedConfig) {
        const activeLayout = matchedConfig.layouts?.find(
          (l: any) => l.id === matchedConfig.activeLayoutId,
        )
        if (activeLayout) {
          const leafIds = getAllLeafIds(activeLayout.layout)
          if (leafIds.length > 0) {
            setActiveTileIdRef.current?.(leafIds[0])
          }
        }
      }
      setWorkspaces(workspaceList.map((w: any) => w.id))

      // Load available views
      const views = await bridgeSystem.getAvailableViews()
      setAvailableViews(views)
    } catch (e) {
      console.error('Failed to load workspace data:', e)
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

  // Keep actions ref in sync for AppContext
  useEffect(() => {
    actionsRef.current = { loadData }
  }, [loadData])

  const switchWorkspace = useCallback(async (id: string) => {
    await workspaceMutations.switch(id)
    // Don't call loadData here — WORKSPACE_CHANGED event will trigger it
  }, [])

  const addWorkspace = useCallback(async (name: string) => {
    // Main process broadcasts WORKSPACE_CHANGED, IPC listener calls loadData
    await workspaceMutations.create(name)
  }, [])

  const deleteWorkspace = useCallback(async (name: string) => {
    // Main process broadcasts WORKSPACE_CHANGED, IPC listener calls loadData
    await workspaceMutations.delete(name)
  }, [])

  const openNewWindow = useCallback(() => {
    systemMutations.openNewWindow()
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
      configMutations
        .set('workspace', { id: workspaceConfig.id, config: workspaceConfig })
        .catch((e) => console.error('Failed to save workspace config:', e))
    }
  }, [workspaceConfig])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaceConfig,
        workspaces,
        availableViews,
        getAllFiles,
        loadData,
        switchWorkspace,
        addWorkspace,
        deleteWorkspace,
        openNewWindow,
        setWorkspaceConfig,
        registerSetActiveTileId,
        registerRefreshThemes,
        actionsRef,
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
