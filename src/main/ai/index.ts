import type { UIMessage } from 'ai'
import { ipcMain } from 'electron'
import { AppEvents, AppOperation } from '../../lib/constants/app'
import { AiChannels } from '../../lib/constants/ipc-channels'
import {
  getWinIdFromSender,
  sendOperationToWindow,
  sendToWindow,
} from '../ipc-utils'
import { trackEvent } from '../telemetry/index'
import { showOpenDialog } from '../window'
import { getWindowWorkspace } from '../window-state'
import {
  aiChat,
  listSessions,
  loadSession,
  loadSessionMetadata,
  saveCompactBackup,
  saveSession,
} from './chat'
import { getMergedSystemPrompt, restoreDefaultPrompts } from './prompts'
import { getToolsMetadata } from './tools'

// ─── Payload types ─────────────────────────────────────────────────────────
interface AiChatPayload {
  messages: UIMessage[]
  config: any
  workspaceFolders: string[]
  activeFile?: string
  workspaceName?: string
}

interface SessionSavePayload {
  sessionId: string
  messages: UIMessage[]
  metadata?: any
}

interface SessionLoadPayload {
  sessionId: string
}

export function setupAiIpc() {
  ipcMain.handle(
    AiChannels.PROMPT_GET_MERGED,
    async (_event, agentId?: string) => {
      return await getMergedSystemPrompt(agentId)
    },
  )
  ipcMain.handle(AiChannels.GET_TOOLS, async () => {
    return await getToolsMetadata()
  })

  ipcMain.handle(AiChannels.CHAT, async (event, params: AiChatPayload) => {
    trackEvent('ai_chat', {
      provider: (params.config?.provider || 'unknown').toLowerCase(),
      message_count: params.messages?.length || 0,
    })
    const winId = getWinIdFromSender(event.sender)
    const provider = params.config?.provider?.toLowerCase()
    if (provider === 'ollama' && !params.config.baseUrl) {
      sendOperationToWindow(winId, AppOperation.SHOW_NOTIFICATION, {
        type: 'warning',
        title: 'Ollama URL not configured',
        message:
          'Using default http://localhost:11434. Set a custom URL in settings if needed.',
      })
    } else if (
      (provider === 'openai' || provider === 'anthropic') &&
      !params.config.apiKey
    ) {
      sendOperationToWindow(winId, AppOperation.SHOW_NOTIFICATION, {
        type: 'error',
        title: 'API Key Missing',
        message: `No API key configured for ${provider}. Add it in Settings > AI Providers.`,
      })
    }
    return await aiChat({ ...params, _winId: winId })
  })

  ipcMain.handle(
    AiChannels.SESSION_SAVE,
    async (event, { sessionId, messages, metadata }: SessionSavePayload) => {
      const winId = getWinIdFromSender(event.sender)
      const workspaceName = await getWindowWorkspace(winId)
      const result = await saveSession(
        workspaceName,
        sessionId,
        messages,
        metadata,
      )
      // Notify views so they can refresh (e.g., workspace view session list)
      sendToWindow(winId, AppEvents.SESSION_SAVED, { id: sessionId })
      return result
    },
  )

  ipcMain.handle(
    AiChannels.SESSION_LOAD,
    async (event, { sessionId }: SessionLoadPayload) => {
      const winId = getWinIdFromSender(event.sender)
      const workspaceName = await getWindowWorkspace(winId)
      return await loadSession(workspaceName, sessionId)
    },
  )

  ipcMain.handle(AiChannels.SESSION_LIST, async (event) => {
    const winId = getWinIdFromSender(event.sender)
    const workspaceName = await getWindowWorkspace(winId)
    return await listSessions(workspaceName)
  })

  ipcMain.handle(
    AiChannels.SESSION_META_LOAD,
    async (event, sessionId: string) => {
      const winId = getWinIdFromSender(event.sender)
      const workspaceName = await getWindowWorkspace(winId)
      return await loadSessionMetadata(workspaceName, sessionId)
    },
  )

  ipcMain.handle(
    AiChannels.SESSION_SAVE_COMPACT,
    async (
      event,
      {
        sessionId,
        timestamp,
        messages,
      }: { sessionId: string; timestamp: number; messages: UIMessage[] },
    ) => {
      const winId = getWinIdFromSender(event.sender)
      const workspaceName = await getWindowWorkspace(winId)
      await saveCompactBackup(workspaceName, sessionId, timestamp, messages)
    },
  )

  ipcMain.handle(AiChannels.PROMPT_RESTORE, async () => {
    return await restoreDefaultPrompts()
  })

  ipcMain.handle(AiChannels.PROMPT_PICK_FILE, async () => {
    const { canceled, filePaths } = await showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle(AiChannels.ARTIFACTS_STATUS, async (event) => {
    const winId = getWinIdFromSender(event.sender)
    const workspaceName = await getWindowWorkspace(winId)
    const {
      exists,
      getWorkspaceMemoryPath,
      getWorkspaceTaskPath,
      getWorkspacePlanPath,
    } = await import('../../lib/path')

    const memoryPath = getWorkspaceMemoryPath(workspaceName)
    const taskPath = getWorkspaceTaskPath(workspaceName)
    const planPath = getWorkspacePlanPath(workspaceName)

    const [memoryExists, taskExists, planExists] = await Promise.all([
      exists(memoryPath),
      exists(taskPath),
      exists(planPath),
    ])

    return {
      memory: { exists: memoryExists, path: memoryPath },
      task: { exists: taskExists, path: taskPath },
      plan: { exists: planExists, path: planPath },
    }
  })
}

export {
  deleteSession,
  getProviderReasoningOptions,
  initWorkspaceFolders,
  listSessions,
  loadSession,
  loadSessionMetadata,
  saveCompactBackup,
  saveSession,
} from './chat'
export { DISABLED_REASONING_OPTIONS, getAIModel } from './factory'
export {
  ensureDefaultPromptFiles,
  getDefaultGlobalPrompts,
  getMergedSystemPrompt,
  restoreDefaultPrompts,
} from './prompts'
export { createTools, getToolsMetadata } from './tools'
