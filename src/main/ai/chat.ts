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

    /**
     * Minimal standardization before official SDK conversion.
     * Sanitizes our custom 'dynamic-tool' parts into standard 'tool-call'/'tool-result' parts
     * so that convertToModelMessages doesn't get confused and duplicate segments.
     */
    const standardizeMessages = (msgs: ChatMessage[]): any[] => {
      return msgs.map((msg) => {
        let currentMsg = { ...msg }

        // 1. Handle command results (inject into text)
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
          currentMsg = {
            ...msg,
            parts: [
              {
                type: 'text',
                text: `${text}\n\nI ran local commands, here are the results:\n\n${resultsText}`,
              },
            ],
          }
        }

        // 2. Bridge dynamic-tool parts to SDK toolInvocations
        if (currentMsg.parts && currentMsg.parts.length > 0) {
          const toolInvocations: any[] = []
          const remainingParts: any[] = []

          currentMsg.parts.forEach((p: any) => {
            if (p.type === 'dynamic-tool') {
              const isResult =
                p.state === 'output-available' || p.state === 'output-error'
              toolInvocations.push({
                state: isResult ? 'result' : 'call',
                toolCallId: p.toolCallId,
                toolName: p.toolName,
                args: p.input,
                result: isResult ? p.output : undefined,
              })
            } else {
              remainingParts.push(p)
            }
          })

          if (toolInvocations.length > 0) {
            // We move tool data to toolInvocations and remove it from parts 
            // to prevent the SDK helper from duplicating the calls/results.
            // OLLAMA FIX: Some local models reject messages with empty content. 
            // We ensure at least one empty text part if remainingParts is empty.
            return {
              ...currentMsg,
              parts: remainingParts.length > 0 ? remainingParts : [{ type: 'text', text: '' }],
              toolInvocations,
            }
          }
        }

        return currentMsg
      })
    }

    const standardized = standardizeMessages(messages)

    // Use official SDK helper to get CoreMessage[]
    const coreMessages = await convertToModelMessages(standardized)

    // FINAL PASS: Ensure compatibility with all providers (especially local ones like Ollama)
    const finalMessages = coreMessages.map((msg) => {
      let currentMsg = { ...msg }

      // 1. Ensure that messages containing tool results have the 'tool' role.
      // The SDK's convertToModelMessages sometimes fails to switch the role if the input UIMessage was 'assistant'.
      if (
        msg.role === 'assistant' &&
        Array.isArray(msg.content) &&
        msg.content.some((p: any) => p.type === 'tool-result')
      ) {
        currentMsg = { ...currentMsg, role: 'tool' } as any
      }

      // 2. Ollama/Local Provider Fix: Flatten reasoning parts into text parts.
      // Many local providers do not support the 'reasoning' part type in the content array.
      if (Array.isArray(currentMsg.content)) {
        currentMsg.content = currentMsg.content.map((part: any) => {
          if (part.type === 'reasoning') {
            return { type: 'text', text: `Thinking:\n${part.text}` }
          }
          return part
        })
      }

      // 3. Ensure content is never empty/null to avoid <nil> errors
      if (!currentMsg.content || (Array.isArray(currentMsg.content) && currentMsg.content.length === 0)) {
        currentMsg.content = ''
      }

      return currentMsg
    })

    console.log('[AI Chat] FINAL MESSAGES TO PROVIDER:', JSON.stringify(finalMessages, null, 2))

    const toolNames = Object.keys(enabledTools)
    console.log(
      `[AI] Starting stream [${requestId}] with tools: [${toolNames.join(', ')}]`,
    )

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
