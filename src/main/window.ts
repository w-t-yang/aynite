import {
  app,
  BrowserWindow,
  dialog,
  type Input,
  ipcMain,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { AppEvents } from '../lib/constants/app'
import {
  AiEventChannels,
  AppEventChannel,
  AppOperationChannel,
} from '../lib/constants/ipc-channels'
import { getPreloadPath, getRendererHtmlPath } from '../lib/path'

let mainWindow: BrowserWindow | null = null

// Approval tracking
const pendingApprovals = new Map<string, (approved: boolean) => void>()

/**
 * Creates the main application window.
 * This is the ONLY place where BrowserWindow should be instantiated.
 */
export function createMainWindow(dirname: string): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aynite',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
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

  // Initialize listeners here to comply with "no listeners outside window.ts" rule
  setupUpdaterListeners()
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

export function sendAppEvent(type: string, data: any) {
  if (!mainWindow) return
  mainWindow.webContents.send(AppEventChannel, { type, data })
}

export function sendAppOperation(operation: string) {
  if (!mainWindow) return
  mainWindow.webContents.send(AppOperationChannel, operation)
}

// ─── Window State & Dialog Helpers ─────────────────────────────────────────

export async function showOpenDialog(options: OpenDialogOptions) {
  return await dialog.showOpenDialog(getMainWindow(), options)
}

export async function showSaveDialog(options: SaveDialogOptions) {
  return await dialog.showSaveDialog(getMainWindow(), options)
}

export async function showMessageBox(options: Electron.MessageBoxOptions) {
  return await dialog.showMessageBox(getMainWindow(), options)
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

// ─── AI Approval Helpers ───────────────────────────────────────────────────

/**
 * Sends an approval request to the renderer and waits for the response.
 * Centralized here to avoid illegal webContents usage in other modules.
 */
export async function requestAiApproval(data: {
  command: string
  cwd: string
}): Promise<boolean> {
  if (!mainWindow) return false

  const approvalId = `approve_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  mainWindow.webContents.send(AiEventChannels.APPROVAL_REQUEST, {
    id: approvalId,
    ...data,
  })

  return new Promise((resolve) => {
    pendingApprovals.set(approvalId, resolve)
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
    },
  )
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

/**
 * Setup auto-updater listeners.
 * Moved here to centralize all event-driven side effects.
 */
function setupUpdaterListeners() {
  autoUpdater.on('checking-for-update', () => {
    sendAppEvent(AppEvents.UPDATE_CHECKING, null)
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendAppEvent(AppEvents.UPDATE_AVAILABLE, info)
  })

  autoUpdater.on('update-not-available', () => {
    sendAppEvent(AppEvents.UPDATE_NOT_AVAILABLE, null)
  })

  autoUpdater.on('error', (err) => {
    sendAppEvent(AppEvents.UPDATE_ERROR, err.message)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    sendAppEvent(AppEvents.UPDATE_PROGRESS, progressObj)
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendAppEvent(AppEvents.UPDATE_DOWNLOADED, info)
  })
}
