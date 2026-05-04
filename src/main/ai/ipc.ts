import { ipcMain, BrowserWindow } from 'electron';
import { handleAiChat } from './chat';
import { getToolsMetadata } from './tools';

export function setupAiIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('api:get-tools', () => {
    return getToolsMetadata();
  });

  ipcMain.handle('api:ai-chat', async (event, params) => {
    return handleAiChat(mainWindow, params);
  });
}
