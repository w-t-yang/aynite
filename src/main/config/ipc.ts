import { ipcMain } from 'electron';
import { loadConfig, saveConfig } from './logic';

export function setupConfigIpc() {
  ipcMain.handle('aynite:config-load', async () => {
    return await loadConfig();
  });

  ipcMain.handle('aynite:config-save', async (event, config) => {
    await saveConfig(config);
    return true;
  });
}
