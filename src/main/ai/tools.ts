import { readFileSync } from 'node:fs'
import { jsonSchema } from '@ai-sdk/provider-utils'
import { SYSTEM_TOOL_GROUPS, TOOL_METADATA } from '../../lib/constants/ai'
import { ERROR_MESSAGES } from '../../lib/constants/messages'
import {
  getAyniteDir,
  getMainConfigPath,
  getWorkspaceDataPath,
} from '../../lib/path'
import type { ToolContext } from '../../lib/types/ai'
import { getShellConfig } from '../system'
import { createFileOps } from './tools/file-ops'
import { createMemoryManager } from './tools/memory-manager'
import { createRunCommand } from './tools/run-command'
import { createTaskManager } from './tools/task-manager'

export type { ToolContext }

/**
 * Tool group → list of tool IDs for that group.
 */
const TOOLS_BY_GROUP: Record<string, string[]> = {}
for (const [id, meta] of Object.entries(TOOL_METADATA)) {
  const group = meta.group
  if (!TOOLS_BY_GROUP[group]) TOOLS_BY_GROUP[group] = []
  TOOLS_BY_GROUP[group].push(id)
}

/**
 * Given an agent's configured tool enablement map and a session type,
 * return the final set of tools that should be available.
 *
 * - For 'general' sessions: only the agent's explicitly enabled tools.
 * - For 'messenger' sessions: agent tools + messenger tools (force-enabled).
 * - For 'flow' sessions: agent tools + flow tools (force-enabled).
 */
export function getEnabledToolsForSession(
  agentTools: Record<string, boolean> | undefined,
  sessionType: string = 'general',
): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const [toolId, meta] of Object.entries(TOOL_METADATA)) {
    // System-managed tools (messenger, flow) default to false — they are only
    // enabled when the session type matches their group.
    if (SYSTEM_TOOL_GROUPS.includes(meta.group)) {
      result[toolId] = false
    } else {
      result[toolId] = agentTools?.[toolId] !== false
    }
  }
  if (sessionType === 'messenger') {
    for (const toolId of TOOLS_BY_GROUP.messenger || []) {
      result[toolId] = true
    }
  }
  if (sessionType === 'flow') {
    for (const toolId of TOOLS_BY_GROUP.flow || []) {
      result[toolId] = true
    }
  }
  return result
}

export function getToolsMetadata() {
  return Object.entries(TOOL_METADATA).map(([id, meta]) => ({
    id,
    ...meta,
  }))
}

function getWorkspaceName(context: ToolContext): string {
  if (context.workspaceName) return context.workspaceName
  return context.workspaceFolders[0] || 'Aynite'
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

function readSpellFolders(): string[] {
  try {
    const configPath = getMainConfigPath()
    const raw = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    const skillsFolders: string[] = config.skills?.folders || []
    const commandsFolders: string[] = config.commands?.folders || []
    return [...skillsFolders, ...commandsFolders]
  } catch {
    return []
  }
}

export function createTools(context: ToolContext) {
  const workspaceFolders = readWorkspaceFolders(context)
  const spellFolders = readSpellFolders()
  const domains = [...workspaceFolders, getAyniteDir(), ...spellFolders]
  const sessionDir = context.sessionDir || ''

  return {
    ...createFileOps(domains, workspaceFolders),
    ...createRunCommand(workspaceFolders, context),
    ...createTaskManager(sessionDir, domains),
    ...createMemoryManager(sessionDir, domains),

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

    // Placeholder — messenger bots override this with their own implementation
    notify_user: {
      description: TOOL_METADATA.notify_user.description,
      inputSchema: jsonSchema(TOOL_METADATA.notify_user.inputSchema),
      execute: async ({ message }: { message: string }) => {
        return `Notification: "${message}" (notify_user is only available in messenger sessions)`
      },
    },

    get_workspace_info: {
      description: TOOL_METADATA.get_workspace_info.description,
      inputSchema: jsonSchema(TOOL_METADATA.get_workspace_info.inputSchema),
      execute: async () => {
        const shellConfig = getShellConfig()
        return {
          workspaceFolders,
          configDir: getAyniteDir(),
          activeFile: context.activeFile || null,
          workspaceName: context.workspaceName || 'Aynite',
          shell: {
            platform: process.platform,
            shell: shellConfig.shell,
            isPowershell: shellConfig.isPowershell,
            runCommandHint: shellConfig.isWindows
              ? shellConfig.isPowershell
                ? 'Use PowerShell syntax. Commands run via: pwsh -NoProfile -Command <command>'
                : 'Use cmd.exe syntax. Commands run via: cmd /d /c <command>'
              : 'Use POSIX shell syntax. Commands run via: <shell> -l -c <command>',
          },
        }
      },
    },

    // Placeholder — not yet implemented
    create_steps: {
      description: TOOL_METADATA.create_steps.description,
      inputSchema: jsonSchema(TOOL_METADATA.create_steps.inputSchema),
      execute: async ({
        _flowId,
        _steps,
      }: {
        _flowId: string
        _steps: any[]
      }) => {
        return 'Flow step creation not yet implemented.'
      },
    },
  }
}
