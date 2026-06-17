import {
  app,
  BrowserWindow,
  dialog,
  type Input,
  ipcMain,
  type OpenDialogOptions,
  type SaveDialogOptions,
  session,
} from 'electron'
import { AppEvents } from '../lib/constants/app'
import {
  AiEventChannels,
  AppEventChannel,
  AppOperationChannel,
} from '../lib/constants/ipc-channels'
import { getIconPath, getPreloadPath, getRendererHtmlPath } from '../lib/path'
import {
  getAllWindowIds,
  registerWindow,
  unregisterWindow,
} from './window-state'

let mainWindow: BrowserWindow | null = null
let appDirname: string = ''

// Approval tracking
const pendingApprovals = new Map<string, (approved: boolean) => void>()
const approvalQueue: Array<{
  id: string
  data: { command: string; cwd: string }
  resolve: (approved: boolean) => void
}> = []
let isProcessingApproval = false

/**
 * Creates the main application window.
 * This is the ONLY place where BrowserWindow should be instantiated.
 */
export function createMainWindow(dirname: string): void {
  // Suppress permission prompts for common browser APIs. These are
  // Chromium-level permissions that on macOS can surface as system dialogs.
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const granted = [
        'clipboard-read',
        'clipboard-sanitized-write',
        'display-capture',
        'fullscreen',
        'localStorage',
        'indexedDB',
        'media',
        'notifications',
        'pointerLock',
        'storage-access',
        'top-level-storage-access',
        'window-management',
      ].includes(permission)
      callback(granted)
    },
  )

  appDirname = dirname
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aynite',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    icon: getIconPath(dirname),
    webPreferences: {
      preload: getPreloadPath(dirname),
      sandbox: false,
      contextIsolation: true,
      nodeIntegrationInSubFrames: true,
    },
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(getRendererHtmlPath(dirname))
  }

  mainWindow.setMenuBarVisibility(false)

  // Register window in the per-window state registry
  registerWindow(mainWindow.id)

  const winId = mainWindow.id

  // Unregister on close (triggers cleanup callbacks like file watcher teardown)
  mainWindow.on('closed', () => {
    unregisterWindow(winId)
    mainWindow = null
  })

  // Broadcast window state changes to this window only
  mainWindow.on('maximize', () => {
    sendToWindow(winId, AppEvents.WINDOW_MAXIMIZED_CHANGED, {
      isMaximized: true,
    })
  })
  mainWindow.on('unmaximize', () => {
    sendToWindow(winId, AppEvents.WINDOW_MAXIMIZED_CHANGED, {
      isMaximized: false,
    })
  })
  // Track fullscreen state changes
  mainWindow.on('enter-full-screen', () => {
    sendToWindow(winId, AppEvents.FULLSCREEN_CHANGED, {
      isFullscreen: true,
    })
  })
  mainWindow.on('leave-full-screen', () => {
    sendToWindow(winId, AppEvents.FULLSCREEN_CHANGED, {
      isFullscreen: false,
    })
  })

  // Initialize listeners here to comply with "no listeners outside window.ts" rule
  setupAiListeners()
}

/**
 * Internal helper to get the main window instance.
 */
function getMainWindow(): BrowserWindow {
  if (!mainWindow) {
    throw new Error('[Window] Main window not initialized')
  }
  return mainWindow
}

/**
 * Check if the main window is currently active.
 */
export function isWindowActive(): boolean {
  return !!mainWindow
}

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

/**
 * Legacy: Send app event to the FIRST window only.
 * Kept for backward compatibility during migration.
 * @deprecated Use sendToWindow() or broadcastAppEvent() instead.
 */
export function sendAppEvent(type: string, data: any) {
  if (!mainWindow) return
  mainWindow.webContents.send(AppEventChannel, { type, data })
}

/**
 * Legacy: Send app operation to the FIRST window only.
 * @deprecated Use sendOperationToWindow() instead.
 */
export function sendAppOperation(operation: string, data?: unknown) {
  if (!mainWindow) return
  mainWindow.webContents.send(AppOperationChannel, operation, data)
}

// ─── Window State & Dialog Helpers ─────────────────────────────────────────

export async function showOpenDialog(options: OpenDialogOptions) {
  return await dialog.showOpenDialog(getMainWindow(), options)
}

export async function showSaveDialog(options: SaveDialogOptions) {
  return await dialog.showSaveDialog(getMainWindow(), options)
}

export function minimizeWindow() {
  getMainWindow().minimize()
}

export function maximizeWindow() {
  const win = getMainWindow()
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
}

export function closeWindow() {
  getMainWindow().close()
}

export function createNewWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aynite',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: getPreloadPath(appDirname),
      sandbox: false,
      contextIsolation: true,
      nodeIntegrationInSubFrames: true,
    },
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(getRendererHtmlPath(appDirname))
  }

  win.setMenuBarVisibility(false)

  // Register new window in the per-window state registry
  registerWindow(win.id)

  // Unregister on close (triggers cleanup callbacks like file watcher teardown)
  win.on('closed', () => {
    unregisterWindow(win.id)
  })
}

// ─── AI Approval Helpers ───────────────────────────────────────────────────

/**
 * Processes the next queued approval request if there is one and no request is currently active.
 */
function processApprovalQueue() {
  if (isProcessingApproval || approvalQueue.length === 0 || !mainWindow) return

  isProcessingApproval = true
  const next = approvalQueue.shift()
  if (!next) return
  pendingApprovals.set(next.id, next.resolve)
  sendAppEvent(AppEvents.AI_APPROVAL_REQUEST, {
    id: next.id,
    ...next.data,
  })
}

/**
 * Sends an approval request to the renderer and waits for the response.
 * Centralized here to avoid illegal webContents usage in other modules.
 * Requests are queued so only one approval UI is shown at a time.
 */
export async function requestAiApproval(data: {
  command: string
  cwd: string
}): Promise<boolean> {
  if (!mainWindow) return false

  const approvalId = `approve_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  return new Promise((resolve) => {
    approvalQueue.push({ id: approvalId, data, resolve })
    processApprovalQueue()
  })
}

function setupAiListeners() {
  ipcMain.on(
    AiEventChannels.APPROVAL_RESPONSE,
    (_, response: { id: string; approved: boolean }) => {
      const resolve = pendingApprovals.get(response.id)
      if (resolve) {
        resolve(response.approved)
        pendingApprovals.delete(response.id)
      }
      // Clear processing flag and process next queued request
      isProcessingApproval = false
      processApprovalQueue()
    },
  )

  ipcMain.on(AppOperationChannel, (_, operation: string, data?: unknown) => {
    sendAppOperation(operation, data)
  })
}

// ─── Window Event Helpers ──────────────────────────────────────────────────

/**
 * Register a listener for the before-input-event on the main window.
 */
export function onBeforeInputEvent(
  callback: (event: Electron.Event, input: Input) => void,
) {
  getMainWindow().webContents.on('before-input-event', callback)
}

// ─── IPC Sender Resolution ────────────────────────────────────────────────

/**
 * Get the BrowserWindow ID from an IPC event's sender WebContents.
 * This is the standard way to identify which window sent an IPC message.
 * Lives here because only window.ts should import BrowserWindow.
 */
export function getWinIdFromSender(sender: Electron.WebContents): number {
  const win = BrowserWindow.fromWebContents(sender)
  return win?.id ?? -1
}

/**
 * Toggle DevTools for the window associated with the given WebContents.
 * Only window.ts should access .webContents — use this helper from other modules.
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
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
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
