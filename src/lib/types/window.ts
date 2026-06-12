export interface WindowActions {
  setMaximized: (isMaximized: boolean) => void
  setFullscreen: (isFullscreen: boolean) => void
}

/**
 * Per-window session tracking for multi-window workspace support.
 * Each Electron window has its own workspace selection independent of other windows.
 */
export interface WindowSession {
  /** The workspace this window is currently using */
  workspaceId: string
  /** Tracks whether the workspace was explicitly changed from the default */
  workspacePinned: boolean
}
