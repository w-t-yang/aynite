import { stepCountIs, streamText } from 'ai'
import { AppEvents } from '../../lib/constants/app'
import {
  appendText,
  getAyniteSessionsDir,
  getLogPath,
  getSessionMetadataPath,
  getSessionPath,
  getSessionsDateDir,
  readdir,
  readJson,
  stat,
  writeJson,
} from '../../lib/path'
import type {
  ChatMessage,
  SessionMetadata,
  StreamPart,
} from '../../lib/types/chat'
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

export async function saveSession(
  id: string,
  messages: ChatMessage[],
  metadata?: SessionMetadata,
) {
  const path = getSessionPath(id)
  const coreMessages = toCoreMessages(messages)
  await writeJson(path, coreMessages)

  if (metadata) {
    const metaPath = getSessionMetadataPath(id)
    const exists = await stat(metaPath).catch(() => null)
    if (!exists) {
      await writeJson(metaPath, metadata)
    }
  }

  sendAppEvent(AppEvents.SESSION_SAVED, id)
}

export async function loadSession(id: string, date?: string) {
  if (date) {
    const path = getSessionPath(id, date)
    return readJson(path).catch(() => null)
  }

  // Find session across all dates
  const dir = getAyniteSessionsDir()
  const dates = await readdir(dir).catch(() => [])
  for (const d of dates) {
    if (!d.isDirectory()) continue
    const dateDir = d.name
    const path = getSessionPath(id, dateDir)
    const content = await readJson(path).catch(() => null)
    if (content) return content
  }
  return null
}

export async function deleteSession(id: string) {
  const dir = getAyniteSessionsDir()
  const dates = await readdir(dir).catch(() => [])
  const { unlink } = await import('node:fs/promises')

  for (const d of dates) {
    if (!d.isDirectory()) continue
    const dateDir = d.name
    const path = getSessionPath(id, dateDir)
    const metaPath = getSessionMetadataPath(id, dateDir)

    if (await stat(path).catch(() => null)) {
      await unlink(path).catch(() => {})
      if (await stat(metaPath).catch(() => null)) {
        await unlink(metaPath).catch(() => {})
      }
    }
  }
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
      if (
        f.isFile() &&
        f.name.endsWith('.json') &&
        !f.name.endsWith('-metadata.json')
      ) {
        const id = f.name.replace('.json', '')
        const sessionPath = getSessionPath(id, date)
        const metaPath = getSessionMetadataPath(id, date)

        const [content, metadata, stats] = await Promise.all([
          readJson(sessionPath).catch(() => null),
          readJson(metaPath).catch(() => null),
          stat(sessionPath).catch(() => null),
        ])

        if (content && Array.isArray(content)) {
          const firstUser = content.find((m) => m.role === 'user')
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

    const systemMessage = messages.find((m) => m.role === 'system')
    const chatMessages = messages.filter((m) => m.role !== 'system')
    const finalMessages = toCoreMessages(chatMessages)

    const _toolNames = Object.keys(enabledTools)

    ;(async () => {
      try {
        const result = streamText({
          model,
          system: (() => {
            if (!systemMessage) return undefined
            const parts =
              systemMessage.parts ||
              (Array.isArray(systemMessage.content)
                ? systemMessage.content
                : [])
            if (parts.length > 0)
              return parts.map((p: any) => p.text || '').join('\n')
            return typeof systemMessage.content === 'string'
              ? systemMessage.content
              : undefined
          })(),
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

/**
 * Converts internal ChatMessage[] to AI SDK CoreMessage[].
 * Handles tool mapping, reasoning flattening, and provider compatibility.
 */
function toCoreMessages(messages: ChatMessage[]): any[] {
  return messages.flatMap((msg) => {
    // 1. Handle already formatted SDK messages (idempotency)
    if (msg.role === 'tool' || (msg as any).content) {
      const content = (msg as any).content || msg.parts
      return [{ role: msg.role, content }]
    }

    let currentParts = [...(msg.parts || [])]

    // 2. Inject command results into user messages
    if (msg.role === 'user' && (msg as any).commandResults?.length > 0) {
      const resultsText = ((msg as any).commandResults as any[])
        .map(
          (res) =>
            `> Command: ${res.command}\n${res.result ?? res.output}${res.exitCode ? `\n(Exit Code: ${res.exitCode})` : ''}`,
        )
        .join('\n\n---\n\n')

      const text = currentParts.map((p: any) => p.text || '').join('')
      currentParts = [
        {
          type: 'text',
          text: `${text}\n\nI ran local commands, here are the results:\n\n${resultsText}`,
        },
      ]
    }

    // 3. Map parts and handle role-splitting
    const assistantParts: any[] = []
    const toolParts: any[] = []
    const otherParts: any[] = []

    for (const p of currentParts) {
      if (p.type === 'dynamic-tool') {
        const isResult =
          p.state === 'output-available' || p.state === 'output-error'
        if (isResult) {
          toolParts.push({
            type: 'tool-result',
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            result: p.output ?? (p as any).result,
            output: p.output ?? (p as any).result,
            isError: p.state === 'output-error',
          })
        } else {
          assistantParts.push({
            type: 'tool-call',
            toolCallId: p.toolCallId,
            toolName: p.toolName,
            args: p.input ?? (p as any).args,
            input: p.input ?? (p as any).args,
          })
        }
      } else if (p.type === 'reasoning') {
        assistantParts.push({ type: 'text', text: `Thinking:\n${p.text}` })
      } else if (p.type === 'text') {
        if (msg.role === 'assistant') assistantParts.push(p)
        else otherParts.push(p)
      } else if (p.type === 'tool-call') {
        assistantParts.push({
          ...p,
          args: p.input ?? p.args,
          input: p.input ?? p.args,
        })
      } else if (p.type === 'tool-result') {
        toolParts.push({
          ...p,
          result: p.output ?? p.result,
          output: p.output ?? p.result,
        })
      } else {
        otherParts.push(p)
      }
    }

    const result: any[] = []

    if (msg.role === 'user' || msg.role === 'system') {
      result.push({
        role: msg.role,
        content:
          otherParts.length > 0 ? otherParts : (msg as any).content || '',
      })
    } else if (msg.role === 'assistant') {
      // If an assistant message contains tool results, we MUST split it
      if (assistantParts.length > 0) {
        result.push({ role: 'assistant', content: assistantParts })
      }
      if (toolParts.length > 0) {
        result.push({ role: 'tool', content: toolParts })
      }
    } else if (msg.role === 'tool') {
      result.push({
        role: 'tool',
        content: toolParts.length > 0 ? toolParts : otherParts,
      })
    }

    return result
  })
}
