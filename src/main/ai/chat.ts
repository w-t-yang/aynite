import path from 'node:path'
import type { TextStreamPart, UIMessage } from 'ai'
import { convertToModelMessages, stepCountIs, streamText } from 'ai'
import { AppEvents } from '../../lib/constants/app'
import {
  appendText,
  getBotsDir,
  getLogPath,
  getSessionCompactPath,
  getSessionDir,
  getSessionMessagesPath,
  getSessionMetadataFilePath,
  getWorkspaceSessionsDir,
  getWorkspacesConfigPath,
  readdir,
  readJson,
  stat,
  writeJson,
} from '../../lib/path'
import type { SessionMetadata } from '../../lib/types/chat'
import { sendToWindow } from '../ipc-utils'
import type { AIProvider } from './factory'
import { getAIModel } from './factory'
import { createTools } from './tools'

/**
 * Maps the unified reasoningEffort setting to each provider's native providerOptions.
 * This lets users control reasoning/thinking behavior from a single dropdown,
 * regardless of which AI provider they use.
 */
export function getProviderReasoningOptions(
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

/**
 * Save a session to disk.
 *
 * Each session lives in its own directory under workspaces/<name>/sessions/<id>/:
 *   - messages.json   — the message array
 *   - metadata.json   — session metadata (agent, model, summary, timestamps)
 */
export async function saveSession(
  workspace: string,
  id: string,
  messages: UIMessage[],
  metadata?: SessionMetadata,
) {
  const { mkdir } = await import('node:fs/promises')
  const sessionDir = getSessionDir(id, workspace)
  await mkdir(sessionDir, { recursive: true }).catch(() => {})

  const path = getSessionMessagesPath(id, workspace)
  await writeJson(path, messages)

  if (metadata) {
    const metaPath = getSessionMetadataFilePath(id, workspace)
    const existing = await readJson<SessionMetadata>(metaPath).catch(() => null)
    await writeJson(metaPath, { ...(existing || {}), ...metadata })
  }
}

/**
 * Load session messages from disk.
 * Returns null if the session does not exist.
 */
export async function loadSession(workspace: string, id: string) {
  const path = getSessionMessagesPath(id, workspace)
  return readJson(path).catch(() => null)
}

/**
 * Load session metadata from disk.
 * Returns null if no metadata file is found.
 */
export async function loadSessionMetadata(
  workspace: string,
  id: string,
): Promise<SessionMetadata | null> {
  const metaPath = getSessionMetadataFilePath(id, workspace)
  return readJson<SessionMetadata>(metaPath).catch(() => null)
}

/**
 * Save a compaction backup — writes the pre-compacted messages to a file
 * named compacted-<timestamp>.json inside the session's directory.
 * This does NOT modify messages.json or metadata.json.
 */
export async function saveCompactBackup(
  workspace: string,
  sessionId: string,
  timestamp: number,
  messages: UIMessage[],
) {
  const { mkdir } = await import('node:fs/promises')
  const sessionDir = getSessionDir(sessionId, workspace)
  await mkdir(sessionDir, { recursive: true }).catch(() => {})
  const path = getSessionCompactPath(sessionId, timestamp, workspace)
  await writeJson(path, messages)
}

/**
 * Delete a session and all its files (messages.json, metadata.json,
 * compacted-*.json backups).
 */
export async function deleteSession(workspace: string, id: string) {
  const { rm } = await import('node:fs/promises')
  const sessionDir = getSessionDir(id, workspace)
  await rm(sessionDir, { recursive: true, force: true }).catch(() => {})
}

/**
 * List all sessions for a workspace.
 *
 * Reads the subdirectories of workspaces/<name>/sessions/, each of which
 * represents a single session. Returns them sorted by last modified time
 * (most recent first).
 */
export async function listSessions(workspace: string) {
  const dir = getWorkspaceSessionsDir(workspace)
  const entries = await readdir(dir).catch(() => [])
  const all: any[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const sessionId = entry.name

    // Safety: skip entries that look like old-style backup IDs
    if (/-\d{13}$/.test(sessionId)) continue

    const messagesPath = getSessionMessagesPath(sessionId, workspace)
    const metaPath = getSessionMetadataFilePath(sessionId, workspace)

    const [content, metadata, stats] = await Promise.all([
      readJson(messagesPath).catch(() => null),
      readJson(metaPath).catch(() => null),
      stat(messagesPath).catch(() => null),
    ])

    if (content && Array.isArray(content)) {
      const contextSize = Math.ceil(JSON.stringify(content).length * 0.4)

      const firstUser = content.find((m: any) => m.role === 'user')
      const preview =
        metadata?.summary ||
        (firstUser as any)?.parts?.map((p: any) => p.text || '').join('') ||
        'No content'

      const title = metadata
        ? `${metadata.agentName} - ${metadata.modelName}`
        : `Session ${sessionId.slice(-6)}`

      const lastModified =
        stats?.mtime.toISOString() || new Date().toISOString()

      // Count messages by their createdAt date.
      // If a message lacks createdAt, fall back to the session ID (ms timestamp).
      const sessionTs = parseInt(sessionId, 10)
      const sessionDateFallback = !Number.isNaN(sessionTs)
        ? new Date(sessionTs).toISOString().split('T')[0]
        : null
      const messageDateCounts: Record<string, number> = {}
      for (const msg of content) {
        const dateStr = (msg as any)?.createdAt
          ? String((msg as any).createdAt).split('T')[0]
          : sessionDateFallback
        if (dateStr) {
          messageDateCounts[dateStr] = (messageDateCounts[dateStr] || 0) + 1
        }
      }

      all.push({
        id: sessionId,
        date: lastModified.split('T')[0],
        title,
        preview,
        lastModified,
        messageCount: content.length,
        contextSize,
        messageDateCounts,
      })
    }
  }

  return all.sort((a, b) => b.lastModified.localeCompare(a.lastModified))
}

/**
 * Aggregate per-date message counts from all workspaces' AI sessions
 * and all messenger bot chat logs.
 *
 * Returns a map of `{ "YYYY-MM-DD": totalCount }` covering the past year.
 */
export async function getCombinedActivityCounts(): Promise<
  Record<string, number>
> {
  const counts: Record<string, number> = {}

  // ── 1. Collect from all workspace sessions ──────────────────────────
  const wsConfig = await readJson<{ active: string; list: string[] }>(
    getWorkspacesConfigPath(),
    { active: 'Aynite', list: ['Aynite'] },
  )
  for (const ws of wsConfig.list) {
    const sessions = await listSessions(ws)
    for (const s of sessions) {
      if ((s as any).messageDateCounts) {
        for (const [dateStr, count] of Object.entries(
          (s as any).messageDateCounts as Record<string, number>,
        )) {
          counts[dateStr] = (counts[dateStr] || 0) + (count as number)
        }
      }
    }
  }

  // ── 2. Collect from all messenger bot date logs ────────────────────
  const DATE_FILE_RE = /^\d{4}-\d{2}-\d{2}\.json$/
  const botsDir = getBotsDir()
  const messengerDirs = await readdir(botsDir).catch(() => [])
  for (const messengerEntry of messengerDirs) {
    if (!messengerEntry.isDirectory()) continue
    const messengerId = messengerEntry.name
    const chatDirs = await readdir(path.join(botsDir, messengerId)).catch(
      () => [],
    )
    for (const chatEntry of chatDirs) {
      if (!chatEntry.isDirectory()) continue
      // Skip non-chat subdirs (session, commits, etc.)
      const chatName = chatEntry.name
      if (chatName === 'session' || chatName === 'commits') continue
      const chatDir = path.join(botsDir, messengerId, chatName)
      const files = await readdir(chatDir).catch(() => [])
      for (const file of files) {
        if (!file.isFile()) continue
        if (!DATE_FILE_RE.test(file.name)) continue
        const dateStr = file.name.replace(/\.json$/, '')
        const messages = await readJson<unknown[]>(
          path.join(chatDir, file.name),
          [],
        )
        if (Array.isArray(messages)) {
          counts[dateStr] = (counts[dateStr] || 0) + messages.length
        }
      }
    }
  }

  return counts
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
    // Dev log: context initialized silently (visible in ai-chat.log)
    appendText(
      getLogPath(),
      `[${new Date().toISOString()}] AI Chat: context initialized for ${workspaceName || 'unknown'}\n`,
    ).catch(() => {})

    const enabledTools: Record<string, any> = {}
    const toolSettings = config.enabledTools || {}

    Object.keys(cachedTools).forEach((toolName) => {
      if (toolSettings[toolName] !== false) {
        enabledTools[toolName] =
          cachedTools[toolName as keyof typeof cachedTools]
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
          stopWhen: stepCountIs(1000),
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

        // Write response summary to dev log instead of console
        const logPath = getLogPath()
        const logEntry =
          `[${new Date().toISOString()}] AI Response [${requestId}]: ` +
          `text=${fullResponseText.length} chars, ` +
          `reasoning=${reasoningText.length} chars, ` +
          `toolCalls=${fullToolCalls.length}\n`
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
