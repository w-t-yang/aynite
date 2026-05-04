import { app, BrowserWindow } from 'electron';
import { streamText, stepCountIs } from 'ai';
import { 
  getAyniteDir, 
  getAyniteLogsDir,
  getAyniteSessionsDir,
  getSessionPath,
  getSessionsDateDir,
  getLogPath,
  readJson,
  writeJson,
  appendText,
  readdir,
  stat
} from '../../lib/path';
import { getAIModel, AIProvider } from './factory';
import { createTools } from './tools';
import { ERROR_MESSAGES } from '../../lib/constants/messages';

/**
 * Saves a chat session history as a JSON file.
 */
export async function saveSession(sessionId: string, messages: any[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const logPath = getSessionPath(sessionId, dateStr);
  await writeJson(logPath, messages);
}

/**
 * Loads a specific chat session history.
 */
export async function loadSession(sessionId: string, date: string) {
  const logPath = getSessionPath(sessionId, date);
  return await readJson(logPath);
}

/**
 * Lists all saved chat sessions.
 */
export async function listSessions() {
  const logsBaseDir = getAyniteSessionsDir();
  const allLogs: any[] = [];

  try {
    const dates = await readdir(logsBaseDir);
    for (const dateEntry of dates) {
      if (!dateEntry.isDirectory()) continue;
      const date = dateEntry.name;
      const dateDir = getSessionsDateDir(date);

      const sessions = await readdir(dateDir);
      for (const sessionEntry of sessions) {
        if (!sessionEntry.name.endsWith('.json')) continue;
        const session = sessionEntry.name;
        const sessionPath = getSessionPath(session.replace('.json', ''), date);
        try {
          const sessionStats = await stat(sessionPath);
          const messages = await readJson(sessionPath);
          if (messages && Array.isArray(messages)) {
            const firstMsg = messages.find((m: any) => m.role === 'user')?.content || messages[0]?.content || '';
            const preview = firstMsg.slice(0, 60) + (firstMsg.length > 60 ? '...' : '');

            allLogs.push({
              id: session.replace('.json', ''),
              date: date,
              lastModified: sessionStats.mtime,
              size: sessionStats.size,
              preview: preview
            });
          }
        } catch (e) {
          console.error(`Error reading session ${session}`, e);
        }
      }
    }
  } catch (e) {
    // Directory might not exist yet
  }

  return allLogs.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
}

/**
 * Helper for logging raw AI events to dev.log (Dev environment only)
 */
async function logEvent(type: 'REQUEST' | 'RESPONSE' | 'ERROR', payload: any) {
  if (app.isPackaged) return;

  try {
    const logFile = getLogPath('dev.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${JSON.stringify(payload, null, 2)}\n${'-'.repeat(80)}\n`;

    await appendText(logFile, logEntry);
  } catch (err) {
    console.error('Failed to log AI event:', err);
  }
}

/**
 * Main handler for AI chat streaming.
 */
export async function handleAiChat(mainWindow: BrowserWindow, { messages, config, workspaceFolders, activeFile }: {
  messages: any[],
  config: AIProvider & { enabledTools?: { [key: string]: boolean } },
  workspaceFolders: string[],
  activeFile?: string
}) {
  const ayniteDir = getAyniteDir();
  // We'll keep this simple check as it doesn't involve complex path assembly
  if (!workspaceFolders.some(f => f === ayniteDir)) {
    workspaceFolders = [...workspaceFolders, ayniteDir];
  }

  logEvent('REQUEST', { config, messages });

  try {
    const model = getAIModel(config);
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const allTools = createTools({
      mainWindow,
      workspaceFolders,
      activeFile
    });

    const enabledTools: any = {};
    const toolSettings = config.enabledTools || {};

    Object.keys(allTools).forEach(toolName => {
      if (toolSettings[toolName] !== false) {
        enabledTools[toolName] = allTools[toolName];
      }
    });

    (async () => {
      try {
        const result = await streamText({
          model,
          messages,
          tools: enabledTools,
          stopWhen: (stepCountIs as any)(10),
        } as any);

        let fullResponseText = '';
        let fullReasoningText = '';
        const fullToolCalls: any[] = [];
        const fullToolResults: any[] = [];

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullResponseText += part.text;
          } else if (part.type === 'reasoning-delta') {
            fullReasoningText += part.text;
          } else if (part.type === 'tool-call') {
            fullToolCalls.push({
              toolName: part.toolName,
              args: part.input,
              toolCallId: part.toolCallId
            });
          } else if (part.type === 'tool-result') {
            fullToolResults.push({
              toolName: part.toolName,
              toolCallId: part.toolCallId,
              result: part.output
            });
          }

          mainWindow.webContents.send(`aynite:ai-chat-delta:${requestId}`, part);
        }

        logEvent('RESPONSE', {
          text: fullResponseText,
          reasoning: fullReasoningText,
          toolCalls: fullToolCalls,
          toolResults: fullToolResults
        });

      } catch (e: any) {
        logEvent('ERROR', { error: e.message });
        mainWindow.webContents.send(`aynite:ai-chat-delta:${requestId}`, { type: 'error', error: e.message });
      }
    })();

    return { requestId };
  } catch (e: any) {
    logEvent('ERROR', { error: e.message });
    return { error: e.message };
  }
}
