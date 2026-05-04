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

import { AiChannels, AiEventChannels, aiChatDeltaChannel } from '../../lib/constants/ipc-channels';






// ─── Payload types ─────────────────────────────────────────────────────────
export interface AiChatPayload {
  messages: any[];
  config: any;
  workspaceFolders: string[];
  activeFile?: string;
}

export interface AiChatResult {
  requestId?: string;
  error?: string;
}

export interface AiApprovalRequest {
  id: string;
  command: string;
  cwd: string;
}

export interface AiApprovalResponse {
  id: string;
  approved: boolean;
}

export interface SessionSavePayload {
  sessionId: string;
  messages: any[];
}

export interface SessionLoadPayload {
  sessionId: string;
  date: string;
}

export interface SystemPromptPayload {
  globalFiles?: string[];
  agentFiles?: string[];
}

export function setupAiIpc(mainWindow: BrowserWindow) {
  ipcMain.handle(AiChannels.PROMPT_GET_MERGED, async (_event, globalFiles?: string[], agentFiles?: string[]) => {
    return await getMergedSystemPrompt(globalFiles, agentFiles);
  });
  ipcMain.handle(AiChannels.GET_TOOLS, async () => {
    return await getToolsMetadata();
  });

  ipcMain.handle(AiChannels.CHAT, async (_event, params: AiChatPayload) => {
    return await handleAiChat(mainWindow, params);
  });

  ipcMain.handle(AiChannels.SESSION_SAVE, async (_event, { sessionId, messages }: SessionSavePayload) => {
    return await saveSession(sessionId, messages);
  });

  ipcMain.handle(AiChannels.SESSION_LOAD, async (_event, { sessionId, date }: SessionLoadPayload) => {
    return await loadSession(sessionId, date);
  });

  ipcMain.handle(AiChannels.SESSION_LIST, async () => {
    return await listSessions();
  });

  ipcMain.handle(AiChannels.PROMPT_RESTORE, async () => {
    return await restoreDefaultPrompts();
  });

  ipcMain.handle(AiChannels.PROMPT_PICK_FILE, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });
}
