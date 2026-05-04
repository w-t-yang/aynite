import { ipcMain, dialog, BrowserWindow } from 'electron';
import { 
  getToolsMetadata, 
} from './tools';
import {
  handleAiChat, 
  saveSession, 
  loadSession, 
  listSessions,
} from './chat';
import {
  restoreDefaultPrompts,
  getMergedSystemPrompt
} from './prompts';

export function setupAiIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('aynite:ai-prompt-get-merged', async (event, globalFiles?: string[], agentFiles?: string[]) => {
    return await getMergedSystemPrompt(globalFiles, agentFiles);
  });
  ipcMain.handle('aynite:ai-get-tools', async () => {
    return await getToolsMetadata();
  });

  ipcMain.handle('aynite:ai-chat', async (event, params) => {
    return await handleAiChat(mainWindow, params);
  });

  ipcMain.handle('aynite:ai-session-save', async (event, { sessionId, messages }: { sessionId: string, messages: any[] }) => {
    return await saveSession(sessionId, messages);
  });

  ipcMain.handle('aynite:ai-session-load', async (event, { sessionId, date }: { sessionId: string, date: string }) => {
    return await loadSession(sessionId, date);
  });

  ipcMain.handle('aynite:ai-session-list', async () => {
    return await listSessions();
  });

  ipcMain.handle('aynite:ai-prompt-restore', async () => {
    return await restoreDefaultPrompts();
  });

  ipcMain.handle('aynite:ai-prompt-pick-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });
}
