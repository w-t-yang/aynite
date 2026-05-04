import { app, BrowserWindow } from 'electron';
import { 
  initAppFolders, 
  setConfigNotificationCallback,
  setupConfigIpc
} from './config/index';
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

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: 'Aynite',
    autoHideMenuBar: true,
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
    setupSystemIpc();

    // Set up configuration error notifications
    setConfigNotificationCallback((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('aynite:config-error', data);
      }
    });

    // Initial watcher setup
    const folders = await getWorkspaceFolders();
    setupWatcher(mainWindow, folders);
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
