import { ipcMain } from 'electron';
import {
  getThemesList,
  getTheme,
  saveTheme,
  restoreDefaultTheme,
  deleteTheme
} from './logic';

import { ThemeChannels } from '../../lib/constants/ipc-channels';





export interface ThemeSavePayload {
  name: string;
  data: any;
}

export function setupThemeIpc() {
  ipcMain.handle(ThemeChannels.LIST, async () => {
    return await getThemesList();
  });

  ipcMain.handle(ThemeChannels.READ, async (_event, name: string) => {
    return await getTheme(name);
  });

  ipcMain.handle(ThemeChannels.SAVE, async (_event, { name, data }: ThemeSavePayload) => {
    await saveTheme(name, data);
    return true;
  });

  ipcMain.handle(ThemeChannels.RESTORE, async (_event, name: string) => {
    return await restoreDefaultTheme(name);
  });

  ipcMain.handle(ThemeChannels.DELETE, async (_event, name: string) => {
    return await deleteTheme(name);
  });
}
