import { app, BrowserWindow, protocol } from 'electron'

// IPC & Logic Modules
import { setupAiIpc } from './ai/index'
import { initAppFolders, setupConfigIpc } from './config/index'
import { setupFileIpc, setupWatcher } from './file/index'
import { setupKeybindings } from './keybindings'
import { setupSpellsIpc } from './spells/index'
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

    // Initial watcher setup
    setupWatcher()

    // 5. Feature Subsystems (AI, Spells)
    setupAiIpc()
    setupSpellsIpc()
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
