import { readFileSync } from 'node:fs'
import { jsonSchema } from '@ai-sdk/provider-utils'
import { TOOL_METADATA } from '../../lib/constants/ai'
import { ERROR_MESSAGES } from '../../lib/constants/messages'
import { getAyniteDir, getWorkspaceDataPath } from '../../lib/path'
import type { ToolContext } from '../../lib/types/ai'
import { createFileOps } from './tools/file-ops'
import { createMemoryManager } from './tools/memory-manager'
import { createRunCommand } from './tools/run-command'
import { createTaskManager } from './tools/task-manager'

export type { ToolContext }

export function getToolsMetadata() {
  return Object.entries(TOOL_METADATA).map(([id, meta]) => ({
    id,
    ...meta,
  }))
}

function getWorkspaceName(context: ToolContext): string {
  if (context.workspaceName) return context.workspaceName
  return context.workspaceFolders[0] || 'Aynite Playbook'
}

function readWorkspaceFolders(context: ToolContext): string[] {
  const workspaceName = getWorkspaceName(context)
  try {
    const configPath = getWorkspaceDataPath(workspaceName)
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    if (Array.isArray(config.folders)) {
      return config.folders
    }
  } catch {
    // Config file may not exist yet, fallback to context value
  }
  return context.workspaceFolders
}

export function createTools(context: ToolContext) {
  const workspaceFolders = readWorkspaceFolders(context)
  const domains = [...workspaceFolders, getAyniteDir()]
  const workspaceName = getWorkspaceName(context)

  return {
    ...createFileOps(domains),
    ...createRunCommand(workspaceFolders, context),
    ...createTaskManager(workspaceName, domains),
    ...createMemoryManager(workspaceName, domains),

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

    get_workspace_info: {
      description: TOOL_METADATA.get_workspace_info.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_workspace_info.inputSchema),
      execute: async () => {
        return {
          workspaceFolders,
          configDir: getAyniteDir(),
          activeFile: context.activeFile || null,
          workspaceName,
        }
      },
    },
  }
}
