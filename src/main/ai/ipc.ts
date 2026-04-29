import { ipcMain, BrowserWindow, app } from 'electron';
import { streamText, tool, stepCountIs } from 'ai';
import { jsonSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { getProviderModel, ProviderConfig } from './factory';
import fs from 'fs/promises';
import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper for logging AI events
function logAiEvent(type: 'REQUEST' | 'RESPONSE' | 'ERROR', payload: any) {

  if (app.isPackaged) return; // Only log in dev environment
  
  try {
    const logDir = path.join(os.homedir(), '.aynite', 'logs');
    const logFile = path.join(logDir, 'dev.log');
    
    mkdirSync(logDir, { recursive: true });
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${JSON.stringify(payload, null, 2)}\n${'-'.repeat(80)}\n`;
    
    appendFileSync(logFile, logEntry);
  } catch (err) {
    console.error('Failed to log AI event:', err);
  }
}

async function isPathWithinWorkspace(filePath: string, workspaceFolders: string[]): Promise<boolean> {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return workspaceFolders.some((folder) => {
    const normalizedFolder = path.resolve(folder).replace(/\\/g, '/');
    return normalized.startsWith(normalizedFolder + '/') || normalized === normalizedFolder;
  });
}

export function setupAiIpc(mainWindow: BrowserWindow) {
  ipcMain.handle('api:ai-chat', async (event, { messages, config, workspaceFolders }: { 
    messages: any[], 
    config: ProviderConfig,
    workspaceFolders: string[]
  }) => {
    // Log the initial request
    logAiEvent('REQUEST', { config, messages });

    try {
      const model = getProviderModel(config);
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      // Define tools for the AI SDK
      const tools: any = {
        read_file: {
          description: 'Read the contents of a file.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute path to the file' }
            },
            required: ['path']
          }),
          execute: async ({ path: filePath }: { path: string }) => {
            if (!(await isPathWithinWorkspace(filePath, workspaceFolders))) {
              return `Error: Access denied. Path "${filePath}" is not within the workspace.`;
            }
            try {
              return await fs.readFile(filePath, 'utf-8');
            } catch (e: any) {
              return `Error reading file: ${e.message}`;
            }
          },
        },
        write_file: {
          description: 'Write content to a file.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute path to the file' },
              content: { type: 'string', description: 'Content to write' }
            },
            required: ['path', 'content']
          }),
          execute: async ({ path: filePath, content }: { path: string, content: string }) => {
            if (!(await isPathWithinWorkspace(filePath, workspaceFolders))) {
              return `Error: Access denied. Path "${filePath}" is not within the workspace.`;
            }
            try {
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              await fs.writeFile(filePath, content, 'utf-8');
              return `Successfully wrote to ${filePath}`;
            } catch (e: any) {
              return `Error writing file: ${e.message}`;
            }
          },
        },
        list_files: {
          description: 'List files in a directory.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Absolute path to the directory' }
            },
            required: ['path']
          }),
          execute: async ({ path: dirPath }: { path: string }) => {
            if (!(await isPathWithinWorkspace(dirPath, workspaceFolders))) {
              return `Error: Access denied. Path "${dirPath}" is not within the workspace.`;
            }
            try {
              const files = await fs.readdir(dirPath, { withFileTypes: true });
              const entries = files.map((f) => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`);
              return entries.join('\n') || '(empty directory)';
            } catch (e: any) {
              return `Error listing files: ${e.message}`;
            }
          },
        },
        run_command: {
          description: 'Execute a shell command.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The shell command' },
              cwd: { type: 'string', description: 'Directory to run in' }
            },
            required: ['command']
          }),
          execute: async ({ command, cwd }: { command: string, cwd?: string }) => {
            const runCwd = cwd || workspaceFolders[0] || '.';
            
            const approvalId = `approve_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
              mainWindow.webContents.send('api:ai-approval-request', { id: approvalId, command, cwd: runCwd });
              
              const approved = await new Promise<boolean>((resolve) => {
                const listener = (_: any, response: { id: string; approved: boolean }) => {
                  if (response.id === approvalId) {
                    ipcMain.removeListener('api:ai-approval-response', listener);
                    resolve(response.approved);
                  }
                };
                ipcMain.on('api:ai-approval-response', listener);
              });
              
              if (!approved) return 'Command rejected by user.';

            try {
              const { stdout, stderr } = await execAsync(command, { cwd: runCwd });
              return `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
            } catch (e: any) {
              return `Execution Error:\n${e.message}\n\nSTDOUT:\n${e.stdout}\n\nSTDERR:\n${e.stderr}`;
            }
          },
        },
      };

      // Construct provider-specific options for thinking mode
      const providerOptions: any = {};
      if (config.thinking) {
        const prov = config.provider.toLowerCase();
        if (prov === 'google' || prov === 'gemini') {
          providerOptions.google = {
            thinkingConfig: {
              includeThoughts: true,
              thinkingBudget: config.thinkingBudget || 2000
            }
          };
        } else if (prov === 'anthropic') {
          providerOptions.anthropic = {
            thinking: {
              type: 'enabled',
              budgetTokens: config.thinkingBudget || 4000
            }
          };
        } else if (prov === 'openai') {
          providerOptions.openai = {
            reasoningEffort: 'medium' // Default for o1/o3
          };
        } else if (prov === 'deepseek') {
          providerOptions.deepseek = {
            thinking: {
              type: 'enabled',
              budgetTokens: config.thinkingBudget || 4000
            }
          };
        }
      }

      // Start streaming
      (async () => {
        try {
          const result = await streamText({
            model,
            messages,
            tools,
            providerOptions,
            stopWhen: (stepCountIs as any)(10), 
          } as any);

          let fullResponseText = '';
          let fullReasoningText = '';
          const fullToolCalls: any[] = [];
          const fullToolResults: any[] = [];

          let stepCount = 0;
          let lastFinishReason = '';

          for await (const part of result.fullStream) {
            // Accumulate for logging
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
            } else if ((part as any).type === 'step-finish') {
              stepCount++;
              lastFinishReason = (part as any).finishReason;
            } else if ((part as any).type === 'finish') {
              lastFinishReason = (part as any).finishReason;
            }

            mainWindow.webContents.send(`api:ai-chat-delta:${requestId}`, part);
          }

          // If we stopped because of the step limit but the AI still wanted to call tools
          if (stepCount >= 10 && lastFinishReason === 'tool-calls') {
            const limitError = 'Tool call limit reached (10 steps). The process was stopped for safety.';
            logAiEvent('ERROR', { error: limitError });
            mainWindow.webContents.send(`api:ai-chat-delta:${requestId}`, { type: 'error', error: limitError });
          }

          // Log the full response once finished
          logAiEvent('RESPONSE', { 
            text: fullResponseText, 
            reasoning: fullReasoningText,
            toolCalls: fullToolCalls,
            toolResults: fullToolResults
          });

        } catch (e: any) {
          logAiEvent('ERROR', { error: e.message });
          mainWindow.webContents.send(`api:ai-chat-delta:${requestId}`, { type: 'error', error: e.message });
        }
      })();

      return { requestId };
    } catch (e: any) {
      logAiEvent('ERROR', { error: e.message });
      return { error: e.message };
    }
  });
}
