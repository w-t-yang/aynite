import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import isDev from 'electron-is-dev';
import log from 'electron-log';

// Configure logger
autoUpdater.logger = log;
(autoUpdater.logger as any).transports.file.level = 'info';

import { UpdateChannels } from '../../lib/constants/ipc-channels';





export function setupUpdater(mainWindow: BrowserWindow) {
  ipcMain.handle(UpdateChannels.CHECK, async () => {
    if (isDev) {
      console.log('Update check skipped in development mode.');
      mainWindow.webContents.send(UpdateChannels.NOT_AVAILABLE);
      return null;
    }
    try {
      return await autoUpdater.checkForUpdatesAndNotify();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to check for updates:', err);
      mainWindow.webContents.send(UpdateChannels.ERROR, message);
      return null;
    }
  });

  ipcMain.handle(UpdateChannels.INSTALL, () => {
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
    mainWindow.webContents.send(UpdateChannels.CHECKING);
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow.webContents.send(UpdateChannels.AVAILABLE, info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send(UpdateChannels.NOT_AVAILABLE);
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send(UpdateChannels.ERROR, err.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send(UpdateChannels.DOWNLOAD_PROGRESS, progressObj);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    mainWindow.webContents.send(UpdateChannels.DOWNLOADED, info);
  });

  // Initial check
  autoUpdater.checkForUpdatesAndNotify();
}
