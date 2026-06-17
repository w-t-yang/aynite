/**
 * ipc-utils — Main-to-Renderer IPC communication utilities.
 *
 * The ONLY module that touches BrowserWindow for sending messages.
 * All other modules import sendToWindow etc. from here instead of window.ts.
 *
 * Responsibilities:
 *   - sendToWindow (window-scoped)
 *   - broadcastAppEvent (global)
 *   - sendOperationToWindow
 *   - getWinIdFromSender / toggleDevToolsBySender / window controls by sender
 *   - Deprecated: sendAppEvent, sendAppOperation (legacy)
 */

import { BrowserWindow } from 'electron'
import {
  AppEventChannel,
  AppOperationChannel,
} from '../lib/constants/ipc-channels'
import { getAllWindowIds } from './window-state'

// ─── Main-to-Renderer Send Helpers ─────────────────────────────────────────

/**
 * Send an app event to a specific window by ID.
 * This is the primary send function — most events should be window-scoped.
 */
export function sendToWindow(winId: number, type: string, data: any) {
  const win = BrowserWindow.fromId(winId)
  if (win && !win.isDestroyed()) {
    win.webContents.send(AppEventChannel, { type, data })
  }
}

/**
 * Send an app event to all registered windows.
 * Use sparingly — only for truly global events (theme changes, updates).
 */
export function broadcastAppEvent(type: string, data: any) {
  for (const winId of getAllWindowIds()) {
    sendToWindow(winId, type, data)
  }
}

/**
 * Send an app operation to a specific window by ID.
 */
export function sendOperationToWindow(
  winId: number,
  operation: string,
  data?: unknown,
) {
  const win = BrowserWindow.fromId(winId)
  if (win && !win.isDestroyed()) {
    win.webContents.send(AppOperationChannel, operation, data)
  }
}

// ─── Legacy Send Helpers (deprecated) ─────────────────────────────────────

/**
 * Legacy: Send app event to the FIRST window only.
 * @deprecated Use sendToWindow() or broadcastAppEvent() instead.
 */
export function sendAppEvent(type: string, data: any) {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length === 0) {
    console.log('[ipc-utils] No windows available, cannot send event:', type)
    return
  }
  wins[0].webContents.send(AppEventChannel, { type, data })
}

/**
 * Legacy: Send app operation to the FIRST window only.
 * @deprecated Use sendOperationToWindow() instead.
 */
export function sendAppOperation(operation: string, data?: unknown) {
  const wins = BrowserWindow.getAllWindows()
  if (wins.length === 0) return
  wins[0].webContents.send(AppOperationChannel, operation, data)
}

// ─── IPC Sender Resolution ────────────────────────────────────────────────

/**
 * Get the BrowserWindow ID from an IPC event's sender WebContents.
 * This is the standard way to identify which window sent an IPC message.
 */
export function getWinIdFromSender(sender: Electron.WebContents): number {
  const win = BrowserWindow.fromWebContents(sender)
  return win?.id ?? -1
}

/**
 * Toggle DevTools for the window associated with the given WebContents.
 */
export function toggleDevToolsForSender(sender: Electron.WebContents): void {
  const win = BrowserWindow.fromWebContents(sender)
  win?.webContents.toggleDevTools()
}

/**
 * Minimize the window associated with the given WebContents.
 */
export function minimizeWindowBySender(sender: Electron.WebContents): void {
  BrowserWindow.fromWebContents(sender)?.minimize()
}

/**
 * Toggle maximize state for the window associated with the given WebContents.
 */
export function toggleMaximizeBySender(sender: Electron.WebContents): void {
  const win = BrowserWindow.fromWebContents(sender)
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
}

/**
 * Close the window associated with the given WebContents.
 */
export function closeWindowBySender(sender: Electron.WebContents): void {
  const win = BrowserWindow.fromWebContents(sender)
  if (win && !win.isDestroyed()) {
    win.close()
  }
}
