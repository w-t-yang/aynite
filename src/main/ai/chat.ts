import type { TextStreamPart, UIMessage } from 'ai'
import { convertToModelMessages, stepCountIs, streamText } from 'ai'
import { AppEvents } from '../../lib/constants/app'
import {
  appendText,
  getLogPath,
  getSessionMetadataPath,
  getSessionPath,
  getSessionsDateDir,
  getWorkspaceSessionsDir,
  readdir,
  readJson,
  stat,
  writeJson,
} from '../../lib/path'
import type { SessionMetadata } from '../../lib/types/chat'
import { sendToWindow } from '../window'
import type { AIProvider } from './factory'
import { getAIModel } from './factory'
import { createTools } from './tools'

/**
 * Maps the unified reasoningEffort setting to each provider's native providerOptions.
 * This lets users control reasoning/thinking behavior from a single dropdown,
 * regardless of which AI provider they use.
 */
function getProviderReasoningOptions(
  config: AIProvider,
): Record<string, any> | undefined {
  const effort = config.reasoningEffort
  if (!effort || effort === 'off') {
    return {
      openai: { reasoning_effort: null },
      anthropic: { thinking: { type: 'disabled' } },
      deepseek: { thinking: { type: 'disabled' } },
      google: { thinkingConfig: {} },
    }
  }

  switch (effort) {
    case 'low':
      return {
        openai: { reasoning_effort: 'low' },
        anthropic: { thinking: { type: 'enabled', budgetTokens: 1024 } },
        deepseek: { thinking: { type: 'enabled' } },
        google: { thinkingConfig: { thinkingLevel: 'low' } },
      }
    case 'medium':
      return {
        openai: { reasoning_effort: 'medium' },
        anthropic: { thinking: { type: 'enabled', budgetTokens: 4096 } },
        deepseek: { thinking: { type: 'enabled' } },
        google: { thinkingConfig: { thinkingLevel: 'medium' } },
      }
    case 'high':
      return {
        openai: { reasoning_effort: 'high' },
        anthropic: { thinking: { type: 'enabled', budgetTokens: 16384 } },
        deepseek: { thinking: { type: 'enabled' } },
        google: { thinkingConfig: { thinkingLevel: 'high' } },
      }
    default:
      return undefined
  }
}

export async function initAiFolders() {
  // Global sessions dir is no longer used; workspace-scoped init happens in initWorkspaceFolders
}

export async function initWorkspaceFolders(workspace: string) {
  const dir = getWorkspaceSessionsDir(workspace)
  const exists = await stat(dir).catch(() => null)
  if (!exists) {
    const fs = await import('node:fs/promises')
    await fs.mkdir(dir, { recursive: true })
  }
}

export async function saveSession(
  workspace: string,
  id: string,
  messages: UIMessage[],
  metadata?: SessionMetadata,
) {
  const path = getSessionPath(id, undefined, workspace)
  await writeJson(path, messages)

  if (metadata) {
    const metaPath = getSessionMetadataPath(id, undefined, workspace)
    const exists = await stat(metaPath).catch(() => null)
    if (!exists) {
      await writeJson(metaPath, metadata)
    }
  }

  // Session saved notification is no longer sent globally.
  // The caller (window-scoped IPC handler) is responsible for any event emission.
}

export async function loadSession(
  workspace: string,
  id: string,
  date?: string,
) {
  if (date) {
    const path = getSessionPath(id, date, workspace)
    return readJson(path).catch(() => null)
  }

  // Find session across all dates
  const dir = getWorkspaceSessionsDir(workspace)
  const dates = await readdir(dir).catch(() => [])
  for (const d of dates) {
    if (!d.isDirectory()) continue
    const dateDir = d.name
    const path = getSessionPath(id, dateDir, workspace)
    const content = await readJson(path).catch(() => null)
    if (content) return content
  }
  return null
}

export async function deleteSession(workspace: string, id: string) {
  const dir = getWorkspaceSessionsDir(workspace)
  const dates = await readdir(dir).catch(() => [])
  const { unlink } = await import('node:fs/promises')

  for (const d of dates) {
    if (!d.isDirectory()) continue
    const dateDir = d.name
    const path = getSessionPath(id, dateDir, workspace)
    const metaPath = getSessionMetadataPath(id, dateDir, workspace)

    if (await stat(path).catch(() => null)) {
      await unlink(path).catch(() => {})
      if (await stat(metaPath).catch(() => null)) {
        await unlink(metaPath).catch(() => {})
      }
    }
  }
}

export async function listSessions(workspace: string) {
  const dir = getWorkspaceSessionsDir(workspace)
  const dates = await readdir(dir).catch(() => [])
  const all: any[] = []
  for (const d of dates) {
    if (!d.isDirectory()) continue
    const date = d.name
    const dPath = getSessionsDateDir(date, workspace)
    const files = await readdir(dPath).catch(() => [])
    for (const f of files) {
      if (
        f.isFile() &&
        f.name.endsWith('.json') &&
        !f.name.endsWith('-metadata.json')
      ) {
        const id = f.name.replace('.json', '')
        const sessionPath = getSessionPath(id, date, workspace)
        const metaPath = getSessionMetadataPath(id, date, workspace)

        const [content, metadata, stats] = await Promise.all([
          readJson(sessionPath).catch(() => null),
          readJson(metaPath).catch(() => null),
          stat(sessionPath).catch(() => null),
        ])

        if (content && Array.isArray(content)) {
          const firstUser = content.find((m: any) => m.role === 'user')
          const preview =
            (firstUser as any)?.parts?.map((p: any) => p.text || '').join('') ||
            'No content'

          const title = metadata
            ? `${metadata.agentName} - ${metadata.modelName}`
            : `Session ${id.slice(-6)}`

          all.push({
            id,
            date,
            title,
            preview,
            lastModified:
              stats?.mtime.toISOString() || new Date().toISOString(),
            messageCount: content.length,
          })
        }
      }
    }
  }

  // De-duplicate by id, keeping the most recent one
  const unique = new Map<string, any>()
  for (const s of all) {
    const existing = unique.get(s.id)
    if (!existing || s.lastModified > existing.lastModified) {
      unique.set(s.id, s)
    }
  }

  return Array.from(unique.values()).sort((a, b) =>
    b.lastModified.localeCompare(a.lastModified),
  )
}

export async function aiChat(params: {
  messages: UIMessage[]
  config: AIProvider & { enabledTools?: Record<string, boolean> }
  workspaceFolders: string[]
  activeFile?: string
  workspaceName?: string
  _winId?: number
}) {
  const {
    messages,
    config,
    workspaceFolders,
    activeFile,
    workspaceName,
    _winId,
  } = params
  const requestId = Math.random().toString(36).slice(2, 10)
  const model = getAIModel(config)
  try {
    const toolContext = {
      workspaceFolders,
      activeFile,
      workspaceName,
      onCommandProgress: (text: string) => {
        emit({ type: 'command-output', text } as any)
      },
    }
    const cachedTools = createTools(toolContext)
    console.log('[AI Chat] Context initialized:', toolContext)

    const enabledTools: Record<string, any> = {}
    const toolSettings = config.enabledTools || {}

    Object.keys(cachedTools).forEach((toolName) => {
      if (toolSettings[toolName] !== false) {
        enabledTools[toolName] = cachedTools[toolName]
      }
    })

    const emit = (part: TextStreamPart<any>) => {
      // Send AI chat delta events to the window that initiated the request
      if (_winId && _winId > 0) {
        sendToWindow(_winId, AppEvents.AI_CHAT_DELTA, { requestId, part })
      } else {
        // Legacy fallback: don't send to any specific window
        console.warn('[AI Chat] No _winId provided, AI delta not sent')
      }
    }

    // Extract system message and convert to model messages
    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')
    const modelMessages = await convertToModelMessages(chatMessages, {
      tools: enabledTools,
      ignoreIncompleteToolCalls: true,
    })

    const system = systemMessage
      ? systemMessage.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('\n')
      : undefined

    ;(async () => {
      try {
        const result = streamText({
          model,
          system,
          messages: modelMessages,
          tools: enabledTools,
          stopWhen: stepCountIs(100),
          providerOptions: getProviderReasoningOptions(config) as any,
        })

        let fullResponseText = ''
        let reasoningText = ''
        const fullToolCalls: any[] = []

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              fullResponseText += part.text
              emit(part)
              break
            case 'reasoning-delta':
              reasoningText += part.text
              emit(part)
              break
            case 'tool-input-delta':
              emit(part)
              break
            case 'tool-call':
              fullToolCalls.push(part)
              emit(part)
              break
            case 'tool-result':
              emit(part)
              break
            case 'finish-step':
            case 'finish':
            case 'error':
            case 'start':
              emit(part)
              break
          }
        }

        console.log(
          `[AI] Full Response [${requestId}]:`,
          JSON.stringify(
            {
              text: fullResponseText,
              reasoning: reasoningText,
              toolCalls: fullToolCalls,
            },
            null,
            2,
          ),
        )

        const logPath = getLogPath()
        const logEntry = `[${new Date().toISOString()}] AI Response: ${fullResponseText.slice(0, 100)}...\n`
        await appendText(logPath, logEntry).catch(() => {})
      } catch (err: any) {
        console.error('[AI Chat Stream Error]', err)
        emit({ type: 'error', error: err.message || String(err) })
      }
    })()

    return { requestId }
  } catch (error: any) {
    console.error('[AI Chat Error]', error)
    throw error
  }
}
