import { ipcMain, BrowserWindow } from 'electron';
import { handleAiChat, saveSession, loadSession, listSessions } from './chat';
import { getToolsMetadata } from './tools';
import { restoreDefaultPrompts, getMergedSystemPrompt } from './prompts';

export function setupAiIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('aynite:ai-get-tools', () => {
    return getToolsMetadata();
  });

  ipcMain.handle('aynite:ai-chat', async (event, params) => {
    return handleAiChat(mainWindow, params);
  });

  ipcMain.handle('aynite:ai-save-session', async (event, { sessionId, messages }) => {
    await saveSession(sessionId, messages);
    return true;
  });

  ipcMain.handle('aynite:ai-load-session', async (event, { sessionId, date }) => {
    return await loadSession(sessionId, date);
  });

  ipcMain.handle('aynite:ai-session-list', async () => {
    return await listSessions();
  });

  ipcMain.handle('aynite:ai-restore-prompts', async () => {
    return await restoreDefaultPrompts();
  });

  ipcMain.handle('aynite:ai-get-merged-prompts', async (_, globalFiles?: string[], agentFiles?: string[]) => {
    return await getMergedSystemPrompt(globalFiles, agentFiles);
  });
}
