/**
 * window.ts — Main process window lifecycle management.
 *
 * The ONLY place where BrowserWindow is instantiated.
 * IPC routing utilities have been extracted to ipc-utils.ts.
 * AI approval queue management has been extracted to approval-queue.ts.
 *
 * Responsibilities:
 *   - createMainWindow / createNewWindow
 *   - Permission handling
 *   - Dialog helpers (showOpenDialog, showSaveDialog)
 *   - Window event listeners (maximize, fullscreen, close)
 *   - onBeforeInputEvent
 */

import {
  app,
  BrowserWindow,
  dialog,
  type Input,
  type OpenDialogOptions,
  type SaveDialogOptions,
  session,
} from 'electron'
import { AppEvents } from '../lib/constants/app'
import { getIconPath, getPreloadPath, getRendererHtmlPath } from '../lib/path'
import { sendToWindow } from './ipc-utils'
import { registerWindow, unregisterWindow } from './window-state'

let mainWindow: BrowserWindow | null = null
let appDirname: string = ''

/**
 * Creates the main application window.
 * This is the ONLY place where BrowserWindow should be instantiated.
 */
export function createMainWindow(dirname: string): void {
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
  registerWindow(mainWindow.id)

  const winId = mainWindow.id

  mainWindow.on('closed', () => {
    unregisterWindow(winId)
    mainWindow = null
  })

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
  mainWindow.on('enter-full-screen', () => {
    sendToWindow(winId, AppEvents.FULLSCREEN_CHANGED, { isFullscreen: true })
  })
  mainWindow.on('leave-full-screen', () => {
    sendToWindow(winId, AppEvents.FULLSCREEN_CHANGED, { isFullscreen: false })
  })
}

/**
 * Internal helper to get the main window instance.
 */
function getMainWindow(): BrowserWindow {
  if (!mainWindow) throw new Error('[Window] Main window not initialized')
  return mainWindow
}

/**
 * Check if the main window is currently active.
 */
export function isWindowActive(): boolean {
  return !!mainWindow
}

// ─── Dialog Helpers ────────────────────────────────────────────────────────

export async function showOpenDialog(options: OpenDialogOptions) {
  return await dialog.showOpenDialog(getMainWindow(), options)
}

export async function showSaveDialog(options: SaveDialogOptions) {
  return await dialog.showSaveDialog(getMainWindow(), options)
}

// ─── Window Controls ──────────────────────────────────────────────────────

export function minimizeWindow() {
  getMainWindow().minimize()
}

export function maximizeWindow() {
  const win = getMainWindow()
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
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
  registerWindow(win.id)

  win.on('closed', () => {
    unregisterWindow(win.id)
  })
}

// ─── Window Event Helpers ─────────────────────────────────────────────────

/**
 * Register a listener for the before-input-event on the main window.
 */
export function onBeforeInputEvent(
  callback: (event: Electron.Event, input: Input) => void,
) {
  getMainWindow().webContents.on('before-input-event', callback)
}
