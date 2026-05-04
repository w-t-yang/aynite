import { ipcMain } from 'electron';
import { loadConfig, saveConfig } from './logic';
import { routeGetConfig, routeSetConfig } from './router';

export function setupConfigIpc() {
  // Legacy config endpoints (used by old window.api bridge)
  ipcMain.handle('aynite:config-load', async () => {
    return await loadConfig();
  });

  ipcMain.handle('aynite:config-save', async (event, config) => {
    await saveConfig(config);
    return true;
  });

  // New key-based config endpoints (used by window.aynite bridge)
  ipcMain.handle('aynite:config-get', async (_event, { key, payload }) => {
    return await routeGetConfig(key, payload);
  });

  ipcMain.handle('aynite:config-set', async (_event, { key, payload }) => {
    return await routeSetConfig(key, payload);
  });
}
