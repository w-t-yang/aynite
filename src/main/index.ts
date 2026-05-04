import { app, BrowserWindow } from 'electron';
import {
  initAppFolders,
  setConfigNotificationCallback,
  setupConfigIpc,
  loadConfig,
} from './config/index';
import { ConfigEventChannels } from './config/ipc';
import { 
  getPreloadPath, 
  getRendererHtmlPath 
} from '../lib/path';
import { setupAiIpc } from './ai/index';
import { setupWorkspaceIpc, getWorkspaceFolders } from './workspace/index';
import { setupUpdater } from './updater';
import { setupThemeIpc } from './theme/index';
import { setupFileIpc, setupWatcher } from './file/index';
import { setupSpellsIpc } from './spells/index';
import { setupSystemIpc, setupProtocol } from './system/index';

let mainWindow: BrowserWindow | null = null;

// Cached keybinding config for before-input-event matching
let cachedKeybindings: any = null;

interface KeyBinding {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  key: string;
}

function matchesKeybinding(input: Electron.Input, binding: KeyBinding): boolean {
  const ctrlMatch = !!binding.ctrl === (input.control || input.meta);
  const shiftMatch = !!binding.shift === input.shift;
  const altMatch = !!binding.alt === input.alt;
  const keyMatch = input.key.toLowerCase() === binding.key.toLowerCase();
  return ctrlMatch && shiftMatch && altMatch && keyMatch;
}

function handleKeyboardInput(input: Electron.Input): string | null {
  if (!cachedKeybindings || input.type !== 'keyDown') return null;

  // Check app-level keybindings
  if (cachedKeybindings.app) {
    for (const [operation, binding] of Object.entries(cachedKeybindings.app)) {
      if (matchesKeybinding(input, binding as KeyBinding)) {
        return operation;
      }
    }
  }

  return null;
}

async function refreshKeybindings() {
  try {
    const config = await loadConfig();
    cachedKeybindings = config.keybindings;
  } catch (e) {
    console.error('Failed to load keybindings:', e);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aynite',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: getPreloadPath(__dirname),
      sandbox: false,
      contextIsolation: true
    }
  });

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(getRendererHtmlPath(__dirname));
  }

  mainWindow.setMenuBarVisibility(false);

  // Keybinding dispatch via before-input-event
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const operation = handleKeyboardInput(input);
    if (operation && mainWindow) {
      mainWindow.webContents.send(ConfigEventChannels.APP_OPERATION, operation);
      event.preventDefault();
    }
  });
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-wayland-ime');
  app.commandLine.appendSwitch('wayland-text-input-v3');
}

app.whenReady().then(async () => {
  setupProtocol();
  await initAppFolders();
  createWindow();

  if (mainWindow) {
    setupAiIpc(mainWindow);
    setupWorkspaceIpc(mainWindow);
    setupUpdater(mainWindow);
    setupConfigIpc();
    setupThemeIpc();
    setupFileIpc();
    setupSpellsIpc(mainWindow);
    setupSystemIpc(mainWindow);

    // Set up configuration error notifications
    setConfigNotificationCallback((data) => {
      if (mainWindow) {
        mainWindow.webContents.send(ConfigEventChannels.CONFIG_ERROR, data);
      }
    });

    // Initial watcher setup
    const folders = await getWorkspaceFolders();
    setupWatcher(mainWindow, folders);

    // Cache keybindings for before-input-event dispatch
    await refreshKeybindings();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
