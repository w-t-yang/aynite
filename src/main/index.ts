import { app, BrowserWindow, protocol } from 'electron'

// IPC & Logic Modules
import { setupAiIpc } from './ai/index'
import { setupApprovalListeners } from './approval-queue'
import { initAppFolders, setupConfigIpc } from './config/index'
import { setupFileIpc } from './file/index'
import { setupFlowIpc } from './flows/index'
import { setupGitIpc } from './git/index'
import { setupKeybindings } from './keybindings'
import { reloadMessengers, setupMessengerIpc } from './messengers'
import { setupRssIpc } from './rss/index'
import { setupSpellsIpc } from './spells/index'
import { setupSpotifyIpc } from './spotify/index'
import { handleSpotifyAuthCode } from './spotify/logic'
import { setupProtocol, setupSystemIpc } from './system/index'
import { endSession, startSession } from './telemetry/index'
import { setupThemeIpc } from './theme/index'
import { setupUpdater } from './updater'
import { createMainWindow, isWindowActive } from './window'
import { setupWorkspaceIpc } from './workspace/index'

/**
 * App Lifecycle & Initialization
 */

// In dev mode, Chromium's networking stack triggers macOS keychain prompts
// ("aynite-app Safe Storage") when loading the Vite dev server over HTTP.
// Use an in-memory mock keychain to avoid system keychain access for SSL
// storage/caching during local development.
if (!app.isPackaged) {
  app.commandLine.appendSwitch('use-mock-keychain')
}

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

  // Start telemetry session (opt-in GA4 usage tracking)
  startSession()

  // 2. Window Initialization (Centralized in window.ts)
  createMainWindow(__dirname)

  if (isWindowActive()) {
    // 3. Approval listeners (AI approval queue)
    setupApprovalListeners()

    // 4. Core IPC & Configuration
    setupConfigIpc()
    setupThemeIpc()
    setupKeybindings()

    setupSystemIpc()
    setupUpdater()

    // 4. Workspace & File Management
    setupWorkspaceIpc()
    setupFileIpc()

    // 5. Feature Subsystems (AI, Spells, Git, Messengers)
    setupAiIpc()
    setupSpellsIpc()
    setupMessengerIpc()

    // 6. Start messenger bots (Telegram, etc.)
    reloadMessengers().catch((err) =>
      console.error('[Messenger] Failed to initialize:', err),
    )
    setupRssIpc()
    setupSpotifyIpc(protocolAvailable)
    setupGitIpc()
    setupFlowIpc()
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

// End telemetry session before quit (flushes events to GA4)
app.on('before-quit', () => {
  endSession()
})
