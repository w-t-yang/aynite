import { ipcMain } from 'electron';
import { loadConfig, saveConfig } from './logic';
import { routeGetConfig, routeSetConfig } from './router';

import { ConfigChannels, ConfigEventChannels } from '../../lib/constants/ipc-channels';




export interface ConfigGetPayload {
  key: string;
  payload?: any;
}

export interface ConfigSetPayload {
  key: string;
  payload: any;
}



export function setupConfigIpc() {
  ipcMain.handle(ConfigChannels.LOAD, async () => {
    return await loadConfig();
  });

  ipcMain.handle(ConfigChannels.SAVE, async (_event, config: any) => {
    await saveConfig(config);
    return true;
  });

  ipcMain.handle(ConfigChannels.GET, async (_event, { key, payload }: ConfigGetPayload) => {
    return await routeGetConfig(key, payload);
  });

  ipcMain.handle(ConfigChannels.SET, async (_event, { key, payload }: ConfigSetPayload) => {
    return await routeSetConfig(key, payload);
  });
}
