/**
 * Window State Registry
 *
 * Maintains per-window state in the main process so each Electron window
 * can independently select which workspace it's working on, which file
 * is active, which session is active, etc.
 *
 * The registry is keyed by Electron's BrowserWindow.id (a unique integer).
 * On window creation, the window is registered with a default workspace.
 * On window close, it is unregistered.
 *
 * The `active` field in the global workspaces config (`workspaces/config.json`)
 * remains for backward compatibility and serves as the default workspace
 * for newly created windows.
 */

import { BrowserWindow } from 'electron'
import { getWorkspacesList } from './workspace/logic'

// ─── Types ────────────────────────────────────────────────────────────────

export interface WindowSession {
  /** The workspace this window is currently using */
  workspaceId: string
  /** Tracks whether the workspace was explicitly changed from the default */
  workspacePinned: boolean
}

// ─── Module-level registry ────────────────────────────────────────────────

const windowRegistry = new Map<number, WindowSession>()

// Per-window cleanup callbacks (e.g., file watchers, timers)
// These are called when a window is unregistered.
const cleanupCallbacks = new Map<number, Array<() => void>>()

/**
 * Register a cleanup callback for a specific window.
 * The callback will be invoked when the window is unregistered.
 */
export function onWindowClose(winId: number, cleanup: () => void): void {
  const callbacks = cleanupCallbacks.get(winId) || []
  callbacks.push(cleanup)
  cleanupCallbacks.set(winId, callbacks)
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Register a window. Called when a new BrowserWindow is created.
 * The window inherits the globally-active workspace as its default.
 */
export function registerWindow(winId: number): WindowSession {
  // Read the global default workspace
  const session: WindowSession = {
    workspaceId: 'Aynite Playbook', // fallback
    workspacePinned: false,
  }

  // Try to load the global active workspace as the starting default
  getWorkspacesList()
    .then((wsConfig) => {
      if (wsConfig?.active) {
        session.workspaceId = wsConfig.active
        windowRegistry.set(winId, session)
      }
    })
    .catch(() => {
      // If workspaces config doesn't exist yet, use fallback
    })

  windowRegistry.set(winId, session)
  return session
}

/**
 * Unregister a window. Called when a BrowserWindow is closed.
 * Fires all cleanup callbacks registered for this window.
 */
export function unregisterWindow(winId: number): void {
  // Fire and remove cleanup callbacks
  const callbacks = cleanupCallbacks.get(winId)
  if (callbacks) {
    for (const cb of callbacks) {
      try {
        cb()
      } catch (e) {
        console.error(
          `[WindowState] Cleanup callback error for win ${winId}:`,
          e,
        )
      }
    }
    cleanupCallbacks.delete(winId)
  }

  windowRegistry.delete(winId)
}

/**
 * Get the workspace ID for a given window.
 * Returns the window's selected workspace, or falls back to the global default.
 */
export async function getWindowWorkspace(winId: number): Promise<string> {
  const session = windowRegistry.get(winId)
  if (session?.workspaceId) return session.workspaceId

  // Fallback: read global active workspace
  try {
    const wsConfig = await getWorkspacesList()
    return wsConfig?.active || 'Aynite Playbook'
  } catch {
    return 'Aynite Playbook'
  }
}

/**
 * Set the workspace for a given window.
 * Does NOT modify the global workspaces config — that remains for backward compat.
 */
export function setWindowWorkspace(winId: number, workspaceId: string): void {
  const session = windowRegistry.get(winId)
  if (session) {
    session.workspaceId = workspaceId
    session.workspacePinned = true
  }
}

/**
 * Get the window session for a given window ID.
 */
export function getWindowSession(winId: number): WindowSession | undefined {
  return windowRegistry.get(winId)
}

/**
 * Check if a window has a registered workspace session.
 */
export function hasWindow(winId: number): boolean {
  return windowRegistry.has(winId)
}

/**
 * Get all registered window IDs.
 */
export function getAllWindowIds(): number[] {
  return Array.from(windowRegistry.keys())
}

/**
 * Get the BrowserWindow ID from an IPC event's sender WebContents.
 * This is the standard way to identify which window sent an IPC message.
 */
export function getWinIdFromSender(sender: Electron.WebContents): number {
  const win = BrowserWindow.fromWebContents(sender)
  return win?.id ?? -1
}
