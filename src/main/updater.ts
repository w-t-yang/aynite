import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import isDev from 'electron-is-dev';
import log from 'electron-log';

// Configure logger
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'info';

export function setupUpdater(mainWindow: BrowserWindow) {
  // Always register handlers to avoid "No handler registered" errors in dev
  ipcMain.handle('update:check', async () => {
    if (isDev) {
      console.log('Update check skipped in development mode.');
      mainWindow.webContents.send('update:not-available');
      return null;
    }
    try {
      return await autoUpdater.checkForUpdatesAndNotify();
    } catch (err: any) {
      console.error('Failed to check for updates:', err);
      mainWindow.webContents.send('update:error', err.message);
      return null;
    }
  });

  ipcMain.handle('update:install', () => {
    if (isDev) {
      console.log('Update install skipped in development mode.');
      return;
    }
    autoUpdater.quitAndInstall();
  });

  if (isDev) {
    return;
  }

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update:checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow.webContents.send('update:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update:not-available');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update:error', err.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update:download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    mainWindow.webContents.send('update:downloaded', info);
  });

  // Initial check
  autoUpdater.checkForUpdatesAndNotify();
}
