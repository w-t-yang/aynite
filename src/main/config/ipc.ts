import { ipcMain } from 'electron';
import { loadConfig, saveConfig } from './logic';
import { routeGetConfig, routeSetConfig } from './router';

// ─── Channel constants ────────────────────────────────────────────────────
export const ConfigChannels = {
  LOAD: 'aynite:config-load',
  SAVE: 'aynite:config-save',
  GET: 'aynite:config-get',
  SET: 'aynite:config-set',
} as const;

export interface ConfigGetPayload {
  key: string;
  payload?: any;
}

export interface ConfigSetPayload {
  key: string;
  payload: any;
}

// Event channels (main → renderer push)
export const ConfigEventChannels = {
  APP_OPERATION: 'aynite:app-operation',
  CONFIG_ERROR: 'aynite:config-error',
  WORKSPACE_CHANGED: 'aynite:workspace-changed',
  THEME_CHANGED: 'aynite:theme-changed',
  VIEW_OPERATION: 'aynite:view-operation',
} as const;

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
