/**
 * App Context — Composition Layer
 *
 * Composes all domain contexts into a single provider and exposes
 * a combined useApp() hook that preserves the original interface.
 *
 * SINGLE EVENT ROUTER — This is the ONLY file that sets up
 * a bridge.events.onAppEvent listener. All events are routed
 * to context providers via their exposed action refs, then
 * relayed to all iframe views via postMessage.
 *
 * Provider nesting order:
 *   Theme > Update > Window > Workspace > Layout > UI > Event Router
 *
 * LayoutProvider reads workspace state from WorkspaceContext internally,
 * so WorkspaceProvider must be above it.
 * UIProvider needs executeAppOperation from LayoutContext.
 */
import type React from 'react'
import { useEffect, useRef } from 'react'
import { AppEvents } from '../../lib/constants/app'
import type { UpdateActions } from '../../lib/types/app'
import type {
  LanguageActions,
  LayoutActions,
  ThemeActions,
  UIActions,
} from '../../lib/types/ui'
import type { WindowActions } from '../../lib/types/window'
import type { WorkspaceActions } from '../../lib/types/workspace'
import { events } from '../bridge/events'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import { LayoutProvider, useLayout } from './contexts/LayoutContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { UIProvider, useUI } from './contexts/UIContext'
import { UpdateProvider, useUpdate } from './contexts/UpdateContext'
import { useWindowState, WindowProvider } from './contexts/WindowContext'
import { useWorkspace, WorkspaceProvider } from './contexts/WorkspaceContext'

// ─── Event Router ──────────────────────────────────────────────────────
// SINGLE point of event reception. All events from main process flow
// through this single listener, which:
//   1. Routes to the correct context provider via action refs
//   2. Relays to all iframe views via postMessage

function useEventRouter() {
  const themeRef = useRef<ThemeActions | null>(null)
  const languageRef = useRef<LanguageActions | null>(null)
  const workspaceRef = useRef<WorkspaceActions | null>(null)
  const uiRef = useRef<UIActions | null>(null)
  const updateRef = useRef<UpdateActions | null>(null)
  const windowRef = useRef<WindowActions | null>(null)
  const layoutRef = useRef<LayoutActions | null>(null)

  // Sync refs from context providers
  const { actionsRef: themeActionsRef } = useTheme()
  const { actionsRef: languageActionsRef } = useLanguage()
  const { actionsRef: workspaceActionsRef } = useWorkspace()
  const { actionsRef: uiActionsRef } = useUI()
  const { actionsRef: updateActionsRef } = useUpdate()
  const { actionsRef: windowActionsRef } = useWindowState()
  const { actionsRef: layoutActionsRef } = useLayout()

  // Keep synced on every render
  themeRef.current = themeActionsRef.current
  languageRef.current = languageActionsRef.current
  workspaceRef.current = workspaceActionsRef.current
  uiRef.current = uiActionsRef.current
  updateRef.current = updateActionsRef.current
  windowRef.current = windowActionsRef.current
  layoutRef.current = layoutActionsRef.current

  useEffect(() => {
    const unbind = events.onAppEvent((event: { type: string; data: any }) => {
      // Step 1: Route to context providers
      switch (event.type) {
        case AppEvents.LANGUAGE_CHANGED: {
          const newLocale = (event.data as any)?.language
          if (newLocale === 'zh' || newLocale === 'en') {
            languageRef.current?.setLocale(newLocale)
          }
          break
        }

        case AppEvents.THEME_CHANGED:
          themeRef.current?.refreshThemes()
          break

        case AppEvents.WORKSPACE_CHANGED:
        case AppEvents.WORKSPACE_UPDATED:
          workspaceRef.current?.loadData()
          break

        case AppEvents.ACTIVE_FILE_CHANGED: {
          const path = (event.data as any)?.path || (event.data as string)
          uiRef.current?.setActiveFile(path)
          break
        }

        case AppEvents.UPDATE_CHECKING:
          updateRef.current?.setChecking()
          break
        case AppEvents.UPDATE_AVAILABLE:
          updateRef.current?.setAvailable(event.data)
          break
        case AppEvents.UPDATE_NOT_AVAILABLE:
          updateRef.current?.setIdle()
          break
        case AppEvents.UPDATE_ERROR:
          updateRef.current?.setError(event.data)
          break
        case AppEvents.UPDATE_DOWNLOADING:
          updateRef.current?.setDownloading(0)
          break
        case AppEvents.UPDATE_PROGRESS:
          updateRef.current?.setDownloading((event.data as any)?.percent ?? 0)
          break
        case AppEvents.UPDATE_DOWNLOADED:
          updateRef.current?.setDownloaded(event.data)
          break

        case AppEvents.WINDOW_MAXIMIZED_CHANGED:
          windowRef.current?.setMaximized(
            (event.data as any)?.isMaximized ?? false,
          )
          break
        case AppEvents.FULLSCREEN_CHANGED:
          windowRef.current?.setFullscreen(
            (event.data as any)?.isFullscreen ?? false,
          )
          break

        case AppEvents.TILE_ACTIVATED:
          if (event.data) {
            layoutRef.current?.setActiveTileId(event.data as string)
          }
          break

        case AppEvents.CONFIG_ERROR:
          console.error('[App] Config Error:', event.data)
          break

        // Events that are view-level only (no main-renderer handler)
        case AppEvents.GIT_STATUS_CHANGED:
        case AppEvents.FS_CHANGE:
        case AppEvents.FILE_RENAMED:
        case AppEvents.FILE_DELETED:
        case AppEvents.AI_CHAT_DELTA:
        case AppEvents.AI_APPROVAL_REQUEST:
        case AppEvents.ACTIVE_SESSION_CHANGED:
        case AppEvents.SESSION_DELETED:
        case AppEvents.SESSION_SAVED:
        case AppEvents.CONFIG_CHANGED:
          // These are relayed to iframes — no main-renderer handler
          break
      }

      // Step 2: Relay to all iframe views via postMessage
      for (const iframe of document.querySelectorAll<HTMLIFrameElement>(
        'iframe',
      )) {
        iframe.contentWindow?.postMessage(
          { type: `aynite:${event.type}`, data: event.data },
          '*',
        )
      }
    })

    return unbind
  }, [])
}

// ─── App Operations Listener ───────────────────────────────────────────
// Listens for operations sent from the main process (e.g. keyboard shortcuts)
// and delegates them to the UI context's operation handler.

function useAppOperations() {
  const { executeAppOperation } = useUI()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const unbind = events.onAppOperation(
      (operation: string, data?: unknown) => {
        executeAppOperation(operation, data)
      },
    )
    return unbind
  }, [executeAppOperation])
}

// ─── Refresh Tile (Hub-level, satisfies postMessage audit rule) ─────────
// The Hub is the only place allowed to call postMessage to iframes.
// This function is injected into UIProvider so REFRESH_TILE operations
// are handled here rather than in LayoutContext.

function refreshActiveTile() {
  const activeTile = document.querySelector('.tile.border-primary')
  if (!activeTile) return
  const iframe = activeTile.querySelector('iframe') as HTMLIFrameElement | null
  if (iframe?.contentWindow) {
    try {
      iframe.contentWindow.location.reload()
    } catch {
      iframe.contentWindow.postMessage({ type: 'aynite:refresh-tile' }, '*')
    }
  }
}

// ─── Inner Providers ────────────────────────────────────────────────────
// Nested inside LayoutProvider, provides UI context and event routing.

const InnerProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { executeAppOperation: layoutExecOp } = useLayout()

  return (
    <UIProvider
      layoutExecuteAppOperation={layoutExecOp}
      refreshTile={refreshActiveTile}
    >
      <EventRouterWrapper />
      <AppOperationsListener />
      {children}
    </UIProvider>
  )
}

function AppOperationsListener() {
  useAppOperations()
  return null
}

function EventRouterWrapper() {
  useEventRouter()
  const { refreshThemes } = useTheme()
  const { registerRefreshThemes } = useWorkspace()
  useEffect(() => {
    refreshThemes()
  }, [refreshThemes])
  useEffect(() => {
    registerRefreshThemes(refreshThemes)
  }, [registerRefreshThemes, refreshThemes])
  return null
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <UpdateProvider>
          <WindowProvider>
            <WorkspaceProvider>
              <LayoutProvider>
                <InnerProviders>{children}</InnerProviders>
              </LayoutProvider>
            </WorkspaceProvider>
          </WindowProvider>
        </UpdateProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

// ─── Combined Hook ──────────────────────────────────────────────────────

export const useApp = () => {
  const workspace = useWorkspace()
  const theme = useTheme()
  const layout = useLayout()
  const update = useUpdate()
  const windowState = useWindowState()
  const ui = useUI()
  const language = useLanguage()

  return {
    // Workspace
    workspaceConfig: workspace.workspaceConfig,
    workspaces: workspace.workspaces,
    availableViews: workspace.availableViews,
    getAllFiles: workspace.getAllFiles,
    loadData: workspace.loadData,
    switchWorkspace: workspace.switchWorkspace,
    addWorkspace: workspace.addWorkspace,
    deleteWorkspace: workspace.deleteWorkspace,
    openNewWindow: workspace.openNewWindow,

    // Theme
    themes: theme.themes,
    activeTheme: theme.activeTheme,
    setTheme: theme.setTheme,

    // Language / i18n
    locale: language.locale,
    setLocale: language.setLocale,

    // Layout
    activeTileId: layout.activeTileId,
    isResizing: layout.isResizing,
    setActiveTileId: layout.setActiveTileId,
    switchLayout: layout.switchLayout,
    addLayout: layout.addLayout,
    removeLayout: layout.removeLayout,
    updateLayout: layout.updateLayout,
    updateTileView: layout.updateTileView,
    handleResizeStart: layout.handleResizeStart,
    handleResizeEnd: layout.handleResizeEnd,

    // Update
    updateStatus: update.updateStatus,
    updateInfo: update.updateInfo,
    updateProgress: update.updateProgress,
    updateError: update.updateError,
    setUpdateStatus: update.setUpdateStatus,
    installUpdate: update.installUpdate,

    // Window
    isMaximized: windowState.isMaximized,
    isFullscreen: windowState.isFullscreen,

    // UI
    showTileControls: ui.showTileControls,
    setShowTileControls: ui.setShowTileControls,
    showFileSwitcher: ui.showFileSwitcher,
    setShowFileSwitcher: ui.setShowFileSwitcher,
    activeFile: ui.activeFile,
    setActiveFile: ui.setActiveFile,
    activeNotification: ui.activeNotification,
    dismissNotification: ui.dismissNotification,
    executeAppOperation: ui.executeAppOperation,
  }
}
