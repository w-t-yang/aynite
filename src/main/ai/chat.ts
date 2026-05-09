import { convertToModelMessages, stepCountIs, streamText } from 'ai'
import { AppEvents } from '../../lib/constants/app'
import {
  appendText,
  getAyniteSessionsDir,
  getLogPath,
  getSessionPath,
  getSessionsDateDir,
  readdir,
  readJson,
  stat,
  writeJson,
} from '../../lib/path'
import type { ChatMessage, StreamPart } from '../../lib/types/chat'
import { sendAppEvent } from '../window'
import type { AIProvider } from './factory'
import { getAIModel } from './factory'
import { createTools } from './tools'

export async function initAiFolders() {
  const dir = getAyniteSessionsDir()
  const exists = await stat(dir).catch(() => null)
  if (!exists) {
    const fs = await import('node:fs/promises')
    await fs.mkdir(dir, { recursive: true })
  }
}

export async function saveSession(id: string, messages: ChatMessage[]) {
  const path = getSessionPath(id)
  await writeJson(path, messages)
}

export async function loadSession(id: string, date: string) {
  const path = getSessionPath(id, date)
  return readJson(path).catch(() => null)
}

export async function listSessions() {
  const dir = getAyniteSessionsDir()
  const dates = await readdir(dir).catch(() => [])
  const all: any[] = []
  for (const d of dates) {
    if (!d.isDirectory()) continue
    const date = d.name
    const dPath = getSessionsDateDir(date)
    const files = await readdir(dPath).catch(() => [])
    for (const f of files) {
      if (f.isFile() && f.name.endsWith('.json')) {
        const id = f.name.replace('.json', '')
        const content = await readJson(getSessionPath(id, date)).catch(
          () => null,
        )
        if (content && Array.isArray(content)) {
          const firstUser = content.find((m) => m.role === 'user')
          const text =
            (firstUser as any)?.parts?.map((p: any) => p.text || '').join('') ||
            'Untitled Chat'

          all.push({
            id,
            date,
            title: text || 'Untitled Chat',
            lastMessage: '',
            messageCount: content.length,
          })
        }
      }
    }
  }
  return all.sort((a, b) => b.id.localeCompare(a.id))
}

export async function aiChat({
  messages,
  config,
  workspaceFolders,
  activeFile,
}: {
  messages: ChatMessage[]
  config: AIProvider & { enabledTools?: Record<string, boolean> }
  workspaceFolders: string[]
  activeFile?: string
}) {
  const requestId = Math.random().toString(36).slice(2, 10)
  const model = getAIModel(config)
  try {
    const toolContext = {
      workspaceFolders,
      activeFile,
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

    const emit = (part: StreamPart) => {
      sendAppEvent(AppEvents.AI_CHAT_DELTA, { requestId, part })
    }

    // Directly map our ChatMessage[] to CoreMessage[] for maximum reliability and compatibility.
    // This bypasses the unreliable convertToModelMessages helper which was stripping tool parts.
    const finalMessages: any[] = messages.flatMap((msg) => {
      // 1. Handle command results for user messages
      let currentParts = [...msg.parts]
      if (
        msg.role === 'user' &&
        'commandResults' in msg &&
        (msg as any).commandResults &&
        (msg as any).commandResults.length > 0
      ) {
        const resultsText = ((msg as any).commandResults as any[])
          .map(
            (res) =>
              `> Command: ${res.command}\n${res.result ?? res.output}${res.exitCode ? `\n(Exit Code: ${res.exitCode})` : ''}`,
          )
          .join('\n\n---\n\n')

        const text = msg.parts.map((p: any) => p.text || '').join('')
        currentParts = [
          {
            type: 'text',
            text: `${text}\n\nI ran local commands, here are the results:\n\n${resultsText}`,
          },
        ]
      }

      // 2. Map internal parts to standard SDK parts
      const coreParts = currentParts
        .map((p: any) => {
          if (p.type === 'dynamic-tool') {
            const isResult =
              p.state === 'output-available' || p.state === 'output-error'
            if (isResult) {
              return {
                type: 'tool-result',
                toolCallId: p.toolCallId,
                toolName: p.toolName,
                result: p.output,
              }
            } else {
              return {
                type: 'tool-call',
                toolCallId: p.toolCallId,
                toolName: p.toolName,
                args: p.input,
              }
            }
          }
          if (p.type === 'reasoning') {
            // Flatten reasoning for local providers (Ollama)
            return { type: 'text', text: `Thinking:\n${p.text}` }
          }
          return p
        })
        .filter(Boolean)

      // 3. Ensure no empty content for Ollama
      if (coreParts.length === 0) {
        coreParts.push({ type: 'text', text: '' })
      }

      // 4. Split into Assistant (calls) and Tool (results) messages if needed
      const toolResultParts = coreParts.filter((p) => p.type === 'tool-result')
      const otherParts = coreParts.filter((p) => p.type !== 'tool-result')

      const result: any[] = []
      if (otherParts.length > 0) {
        // Use string content if there are only text parts (more compatible)
        const allText = otherParts.every((p) => p.type === 'text')
        result.push({
          role: msg.role,
          content: allText ? otherParts.map((p) => p.text).join('') : otherParts,
        })
      }
      if (toolResultParts.length > 0) {
        result.push({ role: 'tool', content: toolResultParts })
      }

      return result
    })

    const toolNames = Object.keys(enabledTools)

    ;(async () => {
      try {
        const result = streamText({
          model,
          messages: finalMessages,
          tools: enabledTools,
          stopWhen: stepCountIs(10),
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
              emit(part as any)
              break
            case 'tool-result':
              emit(part as any)
              break
            case 'finish-step':
              emit({
                type: 'finish-step',
                finishReason: part.finishReason,
                usage: part.usage,
              })
              break
            case 'finish':
              emit({ type: 'finish' })
              break
            case 'error':
              emit({ type: 'error', error: String(part.error) })
              break
            case 'start':
              emit({ type: 'start' })
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
