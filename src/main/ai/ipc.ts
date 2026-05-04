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
    try {
      await saveSession(sessionId, messages);
      return { data: true };
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('aynite:ai-load-session', async (event, { sessionId, date }) => {
    try {
      const data = await loadSession(sessionId, date);
      return { data };
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('aynite:ai-session-list', async () => {
    try {
      const sessions = await listSessions();
      return { data: sessions };
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('aynite:ai-restore-prompts', async () => {
    try {
      const config = await restoreDefaultPrompts();
      return { data: config };
    } catch (error: any) {
      return { error: error.message };
    }
  });

  ipcMain.handle('aynite:ai-get-merged-prompts', async (_, globalFiles?: string[], agentFiles?: string[]) => {
    try {
      const merged = await getMergedSystemPrompt(globalFiles, agentFiles);
      return { data: merged };
    } catch (error: any) {
      return { error: error.message };
    }
  });
}
