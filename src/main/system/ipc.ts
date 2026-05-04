import { app, ipcMain, shell, protocol, net } from 'electron';
import { getSystemFonts } from './logic';

export function setupSystemIpc() {
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
