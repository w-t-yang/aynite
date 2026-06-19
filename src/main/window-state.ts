/**
 * Window State Registry
 *
 * Maintains per-window state in the main process so each Electron window
 * can independently select which workspace it's working on, which file
 * is active, which session is active, etc.
 *
 * The registry is keyed by Electron's BrowserWindow identifier (a unique integer).
 * On window creation, the window is registered with a default workspace.
 * On window close, it is unregistered.
 *
 * The `active` field in the global workspaces config (`workspaces/config.json`)
 * remains for backward compatibility and serves as the default workspace
 * for newly created windows.
 */

import { readFileSync } from 'node:fs'
import { getWorkspacesConfigPath } from '../lib/path'
import type { WindowSession } from '../lib/types/window'
import { getWorkspacesList } from './workspace/logic'

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
 * Register a window. Called when a BrowserWindow instance is created.
 * The window inherits the globally-active workspace as its default.
 * Reads from disk synchronously to avoid race conditions.
 */
export function registerWindow(winId: number): WindowSession {
  // Read the global active workspace from disk synchronously
  let workspaceId = 'Aynite' // fallback
  try {
    const configPath = getWorkspacesConfigPath()
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    if (config?.active && typeof config.active === 'string') {
      workspaceId = config.active
    }
  } catch {
    // Config file may not exist yet, use fallback
  }

  const session: WindowSession = {
    workspaceId,
    workspacePinned: false,
  }

  windowRegistry.set(winId, session)
  return session
}

/**
 * Unregister a window. Called when a BrowserWindow instance is closed.
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
    return wsConfig?.active || 'Aynite'
  } catch {
    return 'Aynite'
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
