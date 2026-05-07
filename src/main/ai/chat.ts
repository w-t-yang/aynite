import { type ModelMessage, stepCountIs, streamText } from 'ai'
import { app } from 'electron'
import { AppEvents } from '../../lib/constants/app'
import type { ChatMessage, StreamPart } from '../../lib/constants/chat'
import {
  appendText,
  getAyniteDir,
  getAyniteSessionsDir,
  getLogPath,
  getSessionPath,
  getSessionsDateDir,
  readdir,
  readJson,
  stat,
  writeJson,
} from '../../lib/path'
import { sendAppEvent } from '../window'
import type { AIProvider } from './factory'
import { getAIModel } from './factory'
import { createTools } from './tools'

// ─── Cached tools with mutable context ───────────────────────────────
// tools.ts functions reference `context.*` instead of destructuring,
// so mutating this object before each request updates the tool closures.

const toolContext = {
  workspaceFolders: [] as string[],
  activeFile: undefined as string | undefined,
}
const cachedTools = createTools(toolContext)

// ─── Session persistence ─────────────────────────────────────────────

export async function saveSession(sessionId: string, messages: ChatMessage[]) {
  const dateStr = new Date().toISOString().split('T')[0]
  const logPath = getSessionPath(sessionId, dateStr)
  await writeJson(logPath, messages)
}

export async function loadSession(
  sessionId: string,
  date: string,
): Promise<ChatMessage[]> {
  const raw = await readJson(getSessionPath(sessionId, date))
  if (!raw || !Array.isArray(raw)) return []
  return raw as ChatMessage[]
}

export async function listSessions() {
  const logsBaseDir = getAyniteSessionsDir()
  const allLogs: {
    id: string
    date: string
    lastModified: Date
    size: number
    preview: string
  }[] = []

  try {
    const dates = await readdir(logsBaseDir)
    for (const dateEntry of dates) {
      if (!dateEntry.isDirectory()) continue
      const date = dateEntry.name
      const dateDir = getSessionsDateDir(date)

      const sessions = await readdir(dateDir)
      for (const sessionEntry of sessions) {
        if (!sessionEntry.name.endsWith('.json')) continue
        const sessionId = sessionEntry.name.replace('.json', '')
        const sessionPath = getSessionPath(sessionId, date)
        try {
          const sessionStats = await stat(sessionPath)
          const messages: ChatMessage[] = await loadSession(sessionId, date)
          if (messages.length > 0) {
            const firstMsg =
              messages.find((m) => m.role === 'user')?.content || ''
            const preview =
              typeof firstMsg === 'string'
                ? firstMsg.slice(0, 60) + (firstMsg.length > 60 ? '...' : '')
                : '(complex message)'

            allLogs.push({
              id: sessionId,
              date,
              lastModified: sessionStats.mtime,
              size: sessionStats.size,
              preview,
            })
          }
        } catch (e) {
          console.error(`Error reading session ${sessionEntry.name}`, e)
        }
      }
    }
  } catch (_e) {
    // Directory might not exist yet
  }

  return allLogs.sort(
    (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
  )
}

// ─── Logging ─────────────────────────────────────────────────────────

async function logEvent(type: 'REQUEST' | 'RESPONSE' | 'ERROR', payload: any) {
  if (app.isPackaged) return
  try {
    const logFile = getLogPath('dev.log')
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${type}] ${JSON.stringify(payload, null, 2)}\n${'-'.repeat(80)}\n`
    await appendText(logFile, logEntry)
  } catch (err) {
    console.error('Failed to log AI event:', err)
  }
}

// ─── Main handler ────────────────────────────────────────────────────

export async function handleAiChat({
  messages,
  config,
  workspaceFolders,
  activeFile,
}: {
  messages: ChatMessage[]
  config: AIProvider & { enabledTools?: { [key: string]: boolean } }
  workspaceFolders: string[]
  activeFile?: string
}) {
  const ayniteDir = getAyniteDir()
  if (!workspaceFolders.some((f) => f === ayniteDir)) {
    workspaceFolders = [...workspaceFolders, ayniteDir]
  }

  logEvent('REQUEST', { config, messages: messages.length })

  try {
    const model = getAIModel(config)
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Update mutable tool context
    toolContext.workspaceFolders = workspaceFolders
    toolContext.activeFile = activeFile

    const enabledTools: Record<string, any> = {}
    const toolSettings = config.enabledTools || {}

    Object.keys(cachedTools).forEach((toolName) => {
      if (toolSettings[toolName] !== false) {
        enabledTools[toolName] = cachedTools[toolName]
      }
    })

    const emit = (part: StreamPart) => {
      sendAppEvent(AppEvents.AI_CHAT_DELTA, { requestId, part })
    }

    ;(async () => {
      try {
        const result = streamText({
          model,
          messages: messages as Array<ModelMessage>,
          tools: enabledTools,
          stopWhen: stepCountIs(10),
        })

        let fullResponseText = ''
        let fullReasoningText = ''
        const fullToolCalls: {
          toolCallId: string
          toolName: string
          args: string
        }[] = []

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            fullResponseText += part.text
            emit({ type: 'text-delta', content: part.text })
          } else if (part.type === 'reasoning-delta') {
            fullReasoningText += part.text
            emit({ type: 'reasoning-delta', content: part.text })
          } else if (part.type === 'tool-call') {
            fullToolCalls.push({
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: JSON.stringify(part.input),
            })
            emit({
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: JSON.stringify(part.input),
            })
          } else if (part.type === 'tool-result') {
            const content =
              typeof part.output === 'string'
                ? part.output
                : JSON.stringify(part.output)
            emit({
              type: 'tool-result',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              content,
            })
          } else if (part.type === 'finish-step') {
            emit({
              type: 'step-finish',
              finishReason: part.finishReason,
              usage: part.usage
                ? {
                    promptTokens: part.usage.inputTokens,
                    completionTokens: part.usage.outputTokens,
                  }
                : undefined,
            })
          } else if (part.type === 'error') {
            const errorMessage =
              part.error instanceof Error
                ? part.error.message
                : String(part.error)
            emit({ type: 'error', error: errorMessage })
          } else if (part.type === 'finish') {
            emit({ type: 'finish' })
          }
        }

        logEvent('RESPONSE', {
          text: fullResponseText,
          reasoning: fullReasoningText,
          toolCalls: fullToolCalls,
        })
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        logEvent('ERROR', { error: message })
        emit({ type: 'error', error: message })
      }
    })()

    return { requestId }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logEvent('ERROR', { error: message })
    throw e
  }
}
