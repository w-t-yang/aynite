import { ipcMain } from 'electron'
import { AiChannels } from '../../lib/constants/ipc-channels'
import type { ChatMessage } from '../../lib/types/chat'
import { showOpenDialog } from '../window'
import { handleAiChat, listSessions, loadSession, saveSession } from './chat'
import { getMergedSystemPrompt, restoreDefaultPrompts } from './prompts'
import { getToolsMetadata } from './tools'

// ─── Payload types ─────────────────────────────────────────────────────────
interface AiChatPayload {
  messages: ChatMessage[]
  config: any
  workspaceFolders: string[]
  activeFile?: string
}

interface SessionSavePayload {
  sessionId: string
  messages: ChatMessage[]
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
    return await handleAiChat(params)
  })

  ipcMain.handle(
    AiChannels.SESSION_SAVE,
    async (_event, { sessionId, messages }: SessionSavePayload) => {
      return await saveSession(sessionId, messages)
    },
  )

  ipcMain.handle(
    AiChannels.SESSION_LOAD,
    async (_event, { sessionId, date }: SessionLoadPayload) => {
      return await loadSession(sessionId, date)
    },
  )

  ipcMain.handle(AiChannels.SESSION_LIST, async () => {
    return await listSessions()
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

export { listSessions, loadSession, saveSession } from './chat'
export {
  ensureDefaultPromptFiles,
  getDefaultGlobalPrompts,
  getMergedSystemPrompt,
  restoreDefaultPrompts,
} from './prompts'
export { getToolsMetadata } from './tools'
