import { app, ipcMain, shell, protocol, net, dialog, BrowserWindow } from 'electron';
import { getSystemFonts } from './logic';
import { copy as fsCopy, getBasename, joinPaths, exists } from '../../lib/path';

let clipboardPath: string | null = null;

// ─── Channel constants ────────────────────────────────────────────────────
import { SystemChannels } from '../../lib/constants/ipc-channels';





export function setupSystemIpc(mainWindow: BrowserWindow) {
  ipcMain.handle(SystemChannels.FONT_LIST, async () => {
    return await getSystemFonts();
  });

  ipcMain.handle(SystemChannels.OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle(SystemChannels.APP_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(SystemChannels.APP_QUIT, () => {
    app.quit();
  });

  ipcMain.handle(SystemChannels.DIALOG_SELECT_FILE, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.handle(SystemChannels.DIALOG_SELECT_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths;
  });

  ipcMain.on(SystemChannels.WINDOW_MINIMIZE, () => {
    mainWindow.minimize();
  });

  ipcMain.on(SystemChannels.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on(SystemChannels.WINDOW_CLOSE, () => {
    mainWindow.close();
  });

  ipcMain.handle(SystemChannels.CLIPBOARD_COPY, async (_event, path: string) => {
    clipboardPath = path;
    return true;
  });

  ipcMain.handle(SystemChannels.CLIPBOARD_PASTE, async (_event, destDir: string) => {
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
