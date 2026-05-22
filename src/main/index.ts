import { app, BrowserWindow, protocol } from 'electron'

// IPC & Logic Modules
import { setupAiIpc } from './ai/index'
import { initAppFolders, setupConfigIpc } from './config/index'
import { setupFileIpc } from './file/index'
import { setupGitIpc } from './git/index'
import { setupKeybindings } from './keybindings'
import { setupRssIpc } from './rss/index'
import { setupSpellsIpc } from './spells/index'
import { setupSpotifyIpc } from './spotify/index'
import { handleSpotifyAuthCode } from './spotify/logic'
import { setupProtocol, setupSystemIpc } from './system/index'
import { setupThemeIpc } from './theme/index'
import { setupUpdater } from './updater'
import { createMainWindow, isWindowActive } from './window'
import { setupWorkspaceIpc } from './workspace/index'

/**
 * App Lifecycle & Initialization
 */

// Linux Specific Optimizations
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-wayland-ime')
  app.commandLine.appendSwitch('wayland-text-input-v3')
}

// Register Custom Protocols
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'aynite',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

/**
 * OS-level protocol registration for aynite://
 * Handles incoming URLs (e.g. aynite://auth/spotify/callback?code=xxx)
 */

// Route incoming aynite:// protocol URLs to the appropriate module
function handleProtocolUrl(urlStr: string) {
  try {
    const url = new URL(urlStr)
    // aynite://auth/spotify/callback?code=xxx
    // parses as hostname=auth, pathname=/spotify/callback
    const route = url.hostname + url.pathname

    if (route === 'auth/spotify/callback') {
      const code = url.searchParams.get('code')
      if (code) handleSpotifyAuthCode(code)
      return
    }
    // Future: route other aynite:// URLs here
  } catch (err) {
    console.error('[Protocol] Failed to handle URL:', urlStr, err)
  }
}

// Single instance lock — required for second-instance protocol events on Linux/Windows
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Focus the existing window
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isMinimized()) win.focus()
    }
    // Check for aynite:// protocol URL in the second instance's args
    const url = argv.find((arg) => arg.startsWith('aynite://'))
    if (url) handleProtocolUrl(url)
  })
}

// Register aynite:// as an OS-level protocol handler
// On Linux this creates a .desktop entry; returns false if unavailable (e.g. dev)
const protocolAvailable = app.setAsDefaultProtocolClient('aynite')

// macOS: handle open-url events
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleProtocolUrl(url)
})

app.whenReady().then(async () => {
  // 1. Essential System Setup
  setupProtocol()
  await initAppFolders()

  // 2. Window Initialization (Centralized in window.ts)
  createMainWindow(__dirname)

  if (isWindowActive()) {
    // 3. Core IPC & Configuration
    setupConfigIpc()
    setupThemeIpc()
    setupKeybindings()

    setupSystemIpc()
    setupUpdater()

    // 4. Workspace & File Management
    setupWorkspaceIpc()
    setupFileIpc()

    // 5. Feature Subsystems (AI, Spells, Git)
    setupAiIpc()
    setupSpellsIpc()
    setupRssIpc()
    setupSpotifyIpc(protocolAvailable)
    setupGitIpc()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(__dirname)
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
