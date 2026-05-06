import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { jsonSchema } from '@ai-sdk/provider-utils'
import { type BrowserWindow, ipcMain } from 'electron'
import { TOOL_METADATA } from '../../lib/constants/ai'
import { AiEventChannels } from '../../lib/constants/ipc-channels'
import { ERROR_MESSAGES } from '../../lib/constants/messages'
import {
  getAyniteDir,
  secureGetFileTree,
  secureGrepSearch,
  secureListDir,
  secureReadText,
  secureWriteText,
} from '../../lib/path'

const execAsync = promisify(exec)

interface ToolContext {
  mainWindow: BrowserWindow
  workspaceFolders: string[]
  activeFile?: string
}

export function getToolsMetadata() {
  return Object.entries(TOOL_METADATA).map(([id, meta]) => ({
    id,
    ...meta,
  }))
}

function createTools(context: ToolContext) {
  const { mainWindow, workspaceFolders, activeFile } = context

  const tools: any = {
    read_file: {
      description: TOOL_METADATA.read_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.read_file.inputSchema),
      execute: async ({ path: filePath }: { path: string }) => {
        return await secureReadText(filePath, workspaceFolders)
      },
    },
    write_file: {
      description: TOOL_METADATA.write_file.description,
      inputSchema: jsonSchema(TOOL_METADATA.write_file.inputSchema),
      execute: async ({
        path: filePath,
        content,
      }: {
        path: string
        content: string
      }) => {
        return await secureWriteText(filePath, content, workspaceFolders)
      },
    },
    list_files: {
      description: TOOL_METADATA.list_files.description,
      inputSchema: jsonSchema(TOOL_METADATA.list_files.inputSchema),
      execute: async ({ path: dirPath }: { path: string }) => {
        return await secureListDir(dirPath, workspaceFolders)
      },
    },
    run_command: {
      description: TOOL_METADATA.run_command.description,
      inputSchema: jsonSchema(TOOL_METADATA.run_command.inputSchema),
      execute: async ({ command, cwd }: { command: string; cwd?: string }) => {
        const runCwd = cwd || workspaceFolders[0] || '.'

        const approvalId = `approve_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
        mainWindow.webContents.send(AiEventChannels.APPROVAL_REQUEST, {
          id: approvalId,
          command,
          cwd: runCwd,
        })

        const approved = await new Promise<boolean>((done) => {
          const listener = (
            _: any,
            response: { id: string; approved: boolean },
          ) => {
            if (response.id === approvalId) {
              ipcMain.removeListener(
                AiEventChannels.APPROVAL_RESPONSE,
                listener,
              )
              done(response.approved)
            }
          }
          ipcMain.on(AiEventChannels.APPROVAL_RESPONSE, listener)
        })

        if (!approved) return ERROR_MESSAGES.COMMAND_REJECTED

        try {
          const { stdout, stderr } = await execAsync(command, { cwd: runCwd })
          const output = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`

          try {
            const parsed = JSON.parse(stdout.trim())
            if (
              parsed &&
              typeof parsed === 'object' &&
              parsed.status === 'error'
            ) {
              throw new Error(output)
            }
          } catch (_jsonErr) {}

          return output
        } catch (e: unknown) {
          const cmdErr = e as {
            stdout?: string
            stderr?: string
            message?: string
          }
          return ERROR_MESSAGES.COMMAND_EXEC_ERROR(
            cmdErr.message || '',
            cmdErr.stdout || '',
            cmdErr.stderr || '',
          )
        }
      },
    },
    grep_search: {
      description: TOOL_METADATA.grep_search.description,
      inputSchema: jsonSchema(TOOL_METADATA.grep_search.inputSchema),
      execute: async ({
        pattern,
        folderPath,
      }: {
        pattern: string
        folderPath: string
      }) => {
        return await secureGrepSearch(folderPath, pattern, workspaceFolders)
      },
    },
    read_url: {
      description: TOOL_METADATA.read_url.description,
      inputSchema: jsonSchema(TOOL_METADATA.read_url.inputSchema),
      execute: async ({ url }: { url: string }) => {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            },
          })
          if (!response.ok)
            return ERROR_MESSAGES.URL_FETCH_ERROR(response.statusText)
          const text = await response.text()
          return text
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 10000)
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          return ERROR_MESSAGES.URL_GENERIC_ERROR(message)
        }
      },
    },
    get_file_tree: {
      description: TOOL_METADATA.get_file_tree.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_file_tree.inputSchema),
      execute: async ({
        path: dirPath,
        depth = 10,
      }: {
        path?: string
        depth?: number
      }) => {
        if (dirPath) {
          return await secureGetFileTree(dirPath, workspaceFolders, depth)
        } else {
          let fullOutput = ''
          for (const folder of workspaceFolders) {
            fullOutput += `Workspace Folder: ${folder}\n`
            fullOutput += await secureGetFileTree(
              folder,
              workspaceFolders,
              depth,
            )
            fullOutput += '\n'
          }
          return fullOutput || ERROR_MESSAGES.WORKSPACE_EMPTY
        }
      },
    },
    get_workspace_info: {
      description: TOOL_METADATA.get_workspace_info.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_workspace_info.inputSchema),
      execute: async () => {
        return {
          workspaceFolders,
          configDir: getAyniteDir(),
          activeFile: activeFile || null,
        }
      },
    },
  }

  return tools
}
