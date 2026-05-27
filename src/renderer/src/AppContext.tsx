/**
 * App Context — Composition Layer
 *
 * Composes all domain contexts into a single provider and exposes
 * a combined useApp() hook that preserves the original interface.
 *
 * The cross-cutting IPC event listener (iframe relaying) lives here
 * since it touches all domains and sends postMessage to all iframes.
 */
import type React from 'react'
import { useEffect, useRef } from 'react'
import { AppEvents } from '../../lib/constants/app'
import { LayoutProvider, useLayout } from './contexts/LayoutContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { UIProvider, useUI } from './contexts/UIContext'
import { UpdateProvider, useUpdate } from './contexts/UpdateContext'
import { useWindowState, WindowProvider } from './contexts/WindowContext'
import { useWorkspace, WorkspaceProvider } from './contexts/WorkspaceContext'

// ─── Cross-cutting IPC Listener ─────────────────────────────────────────
// Relays all app events to iframes via postMessage.
// Must run inside all providers since it's a single global listener.

function useIpcRelay() {
  const { refreshThemes } = useTheme()
  const { loadData } = useWorkspace()

  const handlersRef = useRef({ refreshThemes, loadData })
  useEffect(() => {
    handlersRef.current = { refreshThemes, loadData }
  }, [refreshThemes, loadData])

  useEffect(() => {
    if (!window.aynite) return

    const unbind = window.aynite.onAppEvent(
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

        // 2. Core Reactions
        const { refreshThemes: rt, loadData: ld } = handlersRef.current
        switch (event.type) {
          case AppEvents.CONFIG_ERROR:
            console.error('[App] Config Error:', event.data)
            break
          case AppEvents.THEME_CHANGED:
            rt()
            break
          case AppEvents.WORKSPACE_CHANGED:
          case AppEvents.WORKSPACE_UPDATED:
            ld()
            break
        }
      },
    )

    return unbind
  }, [])
}

// ─── Composed Provider ──────────────────────────────────────────────────

const ComposedProviders: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { setActiveTileId } = useLayout()
  const { executeAppOperation: layoutExecOp } = useLayout()
  useIpcRelay()

  return (
    <WorkspaceProvider setActiveTileId={setActiveTileId}>
      <UIProvider layoutExecuteAppOperation={layoutExecOp}>
        {children}
      </UIProvider>
    </WorkspaceProvider>
  )
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <ThemeProvider>
      <UpdateProvider>
        <WindowProvider>
          <LayoutProvider>
            <ComposedProviders>{children}</ComposedProviders>
          </LayoutProvider>
        </WindowProvider>
      </UpdateProvider>
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

  return {
    // Workspace
    workspaceConfig: workspace.workspaceConfig,
    workspaces: workspace.workspaces,
    availableViews: workspace.availableViews,
    loadData: workspace.loadData,
    switchWorkspace: workspace.switchWorkspace,
    addWorkspace: workspace.addWorkspace,
    deleteWorkspace: workspace.deleteWorkspace,
    openNewWindow: workspace.openNewWindow,

    // Theme
    themes: theme.themes,
    activeTheme: theme.activeTheme,
    setTheme: theme.setTheme,

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

    // Window
    isMaximized: windowState.isMaximized,
    isFullscreen: windowState.isFullscreen,

    // UI
    showTileControls: ui.showTileControls,
    setShowTileControls: ui.setShowTileControls,
    showFileSwitcher: ui.showFileSwitcher,
    setShowFileSwitcher: ui.setShowFileSwitcher,
    activeFile: ui.activeFile,
    showSettings: ui.showSettings,
    settingsTab: ui.settingsTab,
    setShowSettings: ui.setShowSettings,
    activeNotification: ui.activeNotification,
    dismissNotification: ui.dismissNotification,
    executeAppOperation: ui.executeAppOperation,
  }
}
