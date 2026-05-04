import { ipcMain } from 'electron';
import { 
  getThemesList, 
  getTheme, 
  saveTheme, 
  restoreDefaultTheme, 
  deleteTheme 
} from './logic';

export function setupThemeIpc() {
  ipcMain.handle('aynite:theme-list', async () => {
    return await getThemesList();
  });

  ipcMain.handle('aynite:theme-read', async (event, name: string) => {
    return await getTheme(name);
  });

  ipcMain.handle('aynite:theme-save', async (event, { name, data }) => {
    await saveTheme(name, data);
    return true;
  });

  ipcMain.handle('aynite:theme-restore', async (event, name: string) => {
    return await restoreDefaultTheme(name);
  });

  ipcMain.handle('aynite:theme-delete', async (event, name: string) => {
    return await deleteTheme(name);
  });
}
