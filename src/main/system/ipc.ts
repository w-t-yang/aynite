import { app, ipcMain, shell, protocol, net, dialog, BrowserWindow } from 'electron';
import { getSystemFonts } from './logic';
import { copy as fsCopy, getBasename, joinPaths, exists } from '../../lib/path';

let clipboardPath: string | null = null;

export function setupSystemIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('aynite:system-font-list', async () => {
    return await getSystemFonts();
  });

  ipcMain.handle('aynite:system-open-external', async (event, url: string) => {
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('aynite:system-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('aynite:system-app-quit', () => {
    app.quit();
  });

  // Dialog handlers
  ipcMain.handle('aynite:dialog-select-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle('aynite:dialog-select-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths;
  });

  // Window control handlers
  ipcMain.on('aynite:window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('aynite:window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('aynite:window-close', () => {
    mainWindow.close();
  });

  // File clipboard (copy/paste for file operations)
  ipcMain.handle('aynite:file-clipboard-copy', async (_event, path: string) => {
    clipboardPath = path;
    return true;
  });

  ipcMain.handle('aynite:file-clipboard-paste', async (_event, destDir: string) => {
    if (!clipboardPath) return false;
    const fileName = getBasename(clipboardPath);
    const destPath = joinPaths(destDir, fileName);
    if (await exists(clipboardPath)) {
      await fsCopy(clipboardPath, destPath, { recursive: true });
      return true;
    }
    return false;
  });
}

export function setupProtocol() {
  protocol.handle('aynite-resource', (request) => {
    const url = request.url.replace('aynite-resource://', '');
    try {
      const decodedPath = decodeURIComponent(url);
      const fileUrl = 'file://' + (decodedPath.startsWith('/') ? '' : '/') + decodedPath;
      return net.fetch(fileUrl);
    } catch (e) {
      console.error('Failed to handle resource request:', e);
      return new Response('File not found', { status: 404 });
    }
  });
}
