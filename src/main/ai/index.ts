import type { UIMessage } from 'ai'
import { ipcMain } from 'electron'
import { AppOperation } from '../../lib/constants/app'
import { AiChannels } from '../../lib/constants/ipc-channels'
import { sendAppOperation, showOpenDialog } from '../window'
import { getWorkspacesList } from '../workspace/logic'
import { aiChat, listSessions, loadSession, saveSession } from './chat'
import { getMergedSystemPrompt, restoreDefaultPrompts } from './prompts'
import { getToolsMetadata } from './tools'

// ─── Payload types ─────────────────────────────────────────────────────────
interface AiChatPayload {
  messages: UIMessage[]
  config: any
  workspaceFolders: string[]
  activeFile?: string
}

interface SessionSavePayload {
  sessionId: string
  messages: UIMessage[]
  metadata?: any
}

interface SessionLoadPayload {
  sessionId: string
  date: string
}

export function setupAiIpc() {
  ipcMain.handle(
    AiChannels.PROMPT_GET_MERGED,
    async (_event, globalFiles?: string[], agentFiles?: string[]) => {
      return await getMergedSystemPrompt(globalFiles, agentFiles)
    },
  )
  ipcMain.handle(AiChannels.GET_TOOLS, async () => {
    return await getToolsMetadata()
  })

  ipcMain.handle(AiChannels.CHAT, async (_event, params: AiChatPayload) => {
    const provider = params.config?.provider?.toLowerCase()
    if (provider === 'ollama' && !params.config.baseUrl) {
      sendAppOperation(AppOperation.SHOW_NOTIFICATION, {
        type: 'warning',
        title: 'Ollama URL not configured',
        message:
          'Using default http://localhost:11434. Set a custom URL in settings if needed.',
      })
    } else if (
      (provider === 'openai' || provider === 'anthropic') &&
      !params.config.apiKey
    ) {
      sendAppOperation(AppOperation.SHOW_NOTIFICATION, {
        type: 'error',
        title: 'API Key Missing',
        message: `No API key configured for ${provider}. Add it in Settings > AI Providers.`,
      })
    }
    return await aiChat(params)
  })

  ipcMain.handle(
    AiChannels.SESSION_SAVE,
    async (_event, { sessionId, messages, metadata }: SessionSavePayload) => {
      const { active } = await getWorkspacesList()
      return await saveSession(active, sessionId, messages, metadata)
    },
  )

  ipcMain.handle(
    AiChannels.SESSION_LOAD,
    async (_event, { sessionId, date }: SessionLoadPayload) => {
      const { active } = await getWorkspacesList()
      return await loadSession(active, sessionId, date)
    },
  )

  ipcMain.handle(AiChannels.SESSION_LIST, async () => {
    const { active } = await getWorkspacesList()
    return await listSessions(active)
  })

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
}

export { deleteSession, initWorkspaceFolders, listSessions, loadSession, saveSession } from './chat'
export {
  ensureDefaultPromptFiles,
  getDefaultGlobalPrompts,
  getMergedSystemPrompt,
  restoreDefaultPrompts,
} from './prompts'
export { getToolsMetadata } from './tools'
