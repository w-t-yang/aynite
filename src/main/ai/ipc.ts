import { ipcMain, BrowserWindow, app } from 'electron';
import { streamText, tool, stepCountIs, zodSchema } from 'ai';
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
function logAiEvent(type: 'REQUEST' | 'ERROR', payload: any) {

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
    config: ProviderConfig & { autoApproveCommands?: boolean },
    workspaceFolders: string[]
  }) => {
    // Log the initial request
    logAiEvent('REQUEST', { config, messages });

    try {
      const model = getProviderModel(config);
      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      // Define tools for the AI SDK
      const tools: any = {
        read_file: (tool as any)({
          description: 'Read the contents of a file.',
          parameters: zodSchema(z.object({
            path: z.string().describe('Absolute path to the file'),
          })),
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
        }),
        write_file: (tool as any)({
          description: 'Write content to a file.',
          parameters: zodSchema(z.object({
            path: z.string().describe('Absolute path to the file'),
            content: z.string().describe('Content to write'),
          })),
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
        }),
        list_files: (tool as any)({
          description: 'List files in a directory.',
          parameters: zodSchema(z.object({
            path: z.string().describe('Absolute path to the directory'),
          })),
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
        }),
        run_command: (tool as any)({
          description: 'Execute a shell command.',
          parameters: zodSchema(z.object({
            command: z.string().describe('The shell command'),
            cwd: z.string().optional().describe('Directory to run in'),
          })),
          execute: async ({ command, cwd }: { command: string, cwd?: string }) => {
            const runCwd = cwd || workspaceFolders[0] || '.';
            
            if (!config.autoApproveCommands) {
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
            }

            try {
              const { stdout, stderr } = await execAsync(command, { cwd: runCwd });
              return `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
            } catch (e: any) {
              return `Execution Error:\n${e.message}\n\nSTDOUT:\n${e.stdout}\n\nSTDERR:\n${e.stderr}`;
            }
          },
        }),
      };

      // Start streaming
      (async () => {
        try {
          const result = await streamText({
            model,
            messages,
            tools,
            stopWhen: (stepCountIs as any)(10), 
          } as any);

          for await (const part of result.fullStream) {
            mainWindow.webContents.send(`api:ai-chat-delta:${requestId}`, part);
          }

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
