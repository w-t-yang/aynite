/**
 * Shared messenger logic — provider-agnostic command handlers, agent loop,
 * group message buffering, and lifecycle helpers.
 *
 * Each provider adapter (Telegram, Discord) implements the `MessengerContext`
 * interface and delegates to these shared functions.
 */

import { readdirSync } from 'node:fs'
import type { UIMessage } from 'ai'
import type { WorkspaceConfig } from '../../lib/constants/types'
import {
  getAgentPath,
  getAgentsDir,
  getAIConfigPath,
  getBotChatDatePath,
  getBotSessionMessagesPath,
  getBotSessionMetadataPath,
  getMainConfigPath,
  getMessengersConfigPath,
  getWorkspaceDataPath,
  getWorkspacesConfigPath,
  readJson,
  writeJson,
} from '../../lib/path'
import type { MessengerConfig } from '../../lib/types/ai'
import type { SessionMetadata } from '../../lib/types/chat'
import {
  createTools,
  getAIModel,
  getProviderReasoningOptions,
  saveSession,
} from '../ai'

// ─── Abstract Messenger Context ──────────────────────────────────────────

/**
 * Minimal interface that both Telegram and Discord adapters must implement.
 * Command handlers call these methods to reply to users.
 */
export interface MessengerContext {
  /** Reply with plain text */
  reply(text: string): Promise<void>
  /** Reply with markdown-formatted text */
  replyWithMarkdown(text: string): Promise<void>
}

// ─── Bot Instance Map ────────────────────────────────────────────────────

/** Opaque handle for a running bot instance (Telegraf or discord.js Client) */
export interface BotHandle {
  /** Stop the bot (disconnect, cleanup) */
  stop(): void
}

const bots = new Map<string, BotHandle>()
/** Track which bot sessions are currently processing a message */
export const processing = new Set<string>()

// ─── Group Chat Context Buffer ──────────────────────────────────────────

const groupMessageBuffer = new Map<string, string[]>()

function getChatBufferKey(botId: string, chatId: string | number): string {
  return `${botId}:${chatId}`
}

export function getSenderLabel(from: {
  id?: number
  username?: string
  first_name?: string
  last_name?: string
}): string {
  if (!from) return 'Unknown'
  if (from.username) return `@${from.username}`
  return (
    [from.first_name, from.last_name].filter(Boolean).join(' ') ||
    `User ${from.id}`
  )
}

export function pushToGroupBuffer(
  botId: string,
  chatId: string | number,
  entry: string,
  maxSize: number = 100,
) {
  const key = getChatBufferKey(botId, chatId)
  let buffer = groupMessageBuffer.get(key)
  if (!buffer) {
    buffer = []
    groupMessageBuffer.set(key, buffer)
  }
  buffer.push(entry)
  if (buffer.length > maxSize) {
    buffer.splice(0, buffer.length - maxSize)
  }
}

export function getGroupContext(
  botId: string,
  chatId: string | number,
): string {
  const key = getChatBufferKey(botId, chatId)
  const buffer = groupMessageBuffer.get(key)
  if (!buffer || buffer.length === 0) return ''
  return buffer.join('\n')
}

// ─── Config Loading ──────────────────────────────────────────────────────

export function loadConfigs(): Promise<MessengerConfig[]> {
  return readJson<MessengerConfig[]>(getMessengersConfigPath(), [])
}

export function saveConfigsDirect(configs: MessengerConfig[]): Promise<void> {
  return writeJson(getMessengersConfigPath(), configs)
}

function loadAiConfig() {
  return readJson<any>(getAIConfigPath())
}

function loadMainConfig() {
  return readJson<any>(getMainConfigPath())
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Get the currently active workspace name from the workspaces config. */
export async function getActiveWorkspace(): Promise<string> {
  const wsConfig = await readJson<{ active: string; list: string[] }>(
    getWorkspacesConfigPath(),
    { active: 'Aynite', list: ['Aynite'] },
  )
  return wsConfig.active
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*`[]/g, '\\$&')
}

function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Bot Session Management ──────────────────────────────────────────────

/**
 * Per-channel bot session IDs.
 * Keyed by `${messengerId}:${chatName}`, maps to a session ID string.
 * This is purely in-memory — no config file needed.
 */
const botSessionMap = new Map<string, string>()

/** Get or create a session ID for a bot channel. */
export function getOrCreateBotSessionId(
  messengerId: string,
  chatName: string,
): string {
  const key = `${messengerId}:${chatName}`
  let id = botSessionMap.get(key)
  if (!id) {
    id = Date.now().toString()
    botSessionMap.set(key, id)
  }
  return id
}

/** Reset (delete) the session for a channel — next message starts fresh. */
export function resetBotSessionId(messengerId: string, chatName: string) {
  const key = `${messengerId}:${chatName}`
  botSessionMap.delete(key)
}

// ─── Bot Message Persistence ─────────────────────────────────────────────

/**
 * Save an incoming/outgoing message to the per-chat date-based log:
 *   ~/.aynite/bots/<messengerId>/<chatName>/<date>.json
 *
 * Each file is an array of { role, sender, text, timestamp } objects.
 */
export async function saveBotMessage(
  messengerId: string,
  chatName: string,
  role: 'user' | 'assistant',
  sender: string,
  text: string,
) {
  const date = new Date().toISOString().split('T')[0]
  const path = getBotChatDatePath(messengerId, chatName, date)
  const existing = await readJson<Array<Record<string, unknown>>>(path, [])
  existing.push({
    role,
    sender,
    text,
    timestamp: new Date().toISOString(),
  })
  await writeJson(path, existing)
}

// ─── Bot Session Persistence ─────────────────────────────────────────────

/**
 * Save session data to the bot session directory:
 *   ~/.aynite/bots/<messengerId>/<chatName>/session/messages.json
 *   ~/.aynite/bots/<messengerId>/<chatName>/session/metadata.json
 */
export async function saveBotSession(
  messengerId: string,
  chatName: string,
  messages: UIMessage[],
  metadata?: SessionMetadata,
) {
  const { mkdir } = await import('node:fs/promises')

  const msgPath = getBotSessionMessagesPath(messengerId, chatName)
  const dir = msgPath.substring(0, msgPath.lastIndexOf('/'))
  await mkdir(dir, { recursive: true }).catch(() => {})
  await writeJson(msgPath, messages)

  if (metadata) {
    const metaPath = getBotSessionMetadataPath(messengerId, chatName)
    const existing = await readJson<SessionMetadata>(metaPath).catch(() => null)
    await writeJson(metaPath, { ...(existing || {}), ...metadata })
  }
}

/**
 * Load bot session messages from disk.
 * Returns empty array if the session does not exist.
 */
export async function loadBotSessionMessages(
  messengerId: string,
  chatName: string,
): Promise<UIMessage[]> {
  const path = getBotSessionMessagesPath(messengerId, chatName)
  const msgs = await readJson<UIMessage[]>(path).catch(() => null)
  return msgs || []
}

/**
 * Load bot session metadata from disk.
 * Returns null if no metadata file is found.
 */
export async function loadBotSessionMetadata(
  messengerId: string,
  chatName: string,
): Promise<SessionMetadata | null> {
  const path = getBotSessionMetadataPath(messengerId, chatName)
  return readJson<SessionMetadata>(path).catch(() => null)
}

// ─── Agent Loop ──────────────────────────────────────────────────────────

export async function runMessengerAgent(
  messages: UIMessage[],
  workspaceName: string,
  workspaceFolders: string[],
  activeFile: string,
  enabledTools: Record<string, boolean>,
  onProgress: (text: string) => void,
  sessionId: string,
  /** Optional bot session info — if provided, saves use bot paths instead of workspace paths */
  botSession?: {
    messengerId: string
    chatName: string
    /** Reply function for notify_user tool */
    reply: (text: string) => Promise<void>
  },
): Promise<UIMessage[]> {
  const aiConfig = await loadAiConfig()
  const activeProvider =
    aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
    aiConfig?.providers?.[0]

  if (!activeProvider) throw new Error('No active AI provider configured')

  console.log(
    `[Messenger] runMessengerAgent: starting with ${messages.length} messages, provider=${activeProvider?.provider} model=${activeProvider?.model}`,
  )

  const { streamText, convertToModelMessages, stepCountIs } = await import('ai')
  const model = getAIModel(activeProvider)

  const systemMessage = messages.find((m) => m.role === 'system')
  const chatMessages = messages.filter((m) => m.role !== 'system')
  const modelMessages = await convertToModelMessages(chatMessages, {
    tools: enabledTools as any,
    ignoreIncompleteToolCalls: true,
  })

  const system = systemMessage
    ? systemMessage.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n')
    : undefined

  const toolContext = {
    workspaceFolders,
    activeFile,
    workspaceName,
    onCommandProgress: (text: string) => onProgress(text),
    autoApproveCommands: true,
  }
  const tools = createTools(toolContext)

  // Add get_messages tool when running in messenger/bot session mode.
  // This allows the AI to fetch history from the per-chat message logs.
  if (botSession) {
    const { createGetMessagesTool } = await import('../ai/tools/get-messages')
    ;(tools as any).get_messages = createGetMessagesTool(
      botSession.messengerId,
      botSession.chatName,
    )
    const { createNotifyUserTool } = await import('../ai/tools/notify-user')
    ;(tools as any).notify_user = createNotifyUserTool({
      reply: (text: string) => botSession.reply(text),
      replyWithMarkdown: (text: string) => botSession.reply(text),
    })
  }

  console.log(
    `[Messenger] calling streamText with ${Object.keys(tools).length} tools`,
  )

  const result = streamText({
    model,
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(100),
    providerOptions: getProviderReasoningOptions(activeProvider) as any,
  })

  const loopMessages: UIMessage[] = []
  let textAccum = ''
  let reasoningAccum = ''
  const allToolCalls = new Map<string, any>()
  let currentStepToolCalls: any[] = []
  let stepCount = 0

  const flushAssistant = () => {
    if (textAccum || reasoningAccum || currentStepToolCalls.length > 0) {
      const parts: any[] = []
      if (reasoningAccum) {
        parts.push({ type: 'reasoning', text: reasoningAccum, state: 'done' })
      }
      if (textAccum) {
        parts.push({ type: 'text', text: textAccum, state: 'done' })
      }
      for (const tc of currentStepToolCalls) {
        parts.push({
          type: 'dynamic-tool',
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          state: 'input-available',
          input: tc.input || tc.args,
        } as any)
      }
      loopMessages.push({ id: genId(), role: 'assistant', parts })
      textAccum = ''
      reasoningAccum = ''
      currentStepToolCalls = []
    }
  }

  for await (const part of result.fullStream) {
    switch (part.type) {
      case 'start':
        console.log(`[Messenger] streamText step ${++stepCount} started`)
        break
      case 'text-delta':
        textAccum += part.text
        break
      case 'reasoning-delta':
        reasoningAccum += part.text
        break
      case 'tool-call': {
        console.log(
          `[Messenger] tool-call: ${part.toolName} (id: ${part.toolCallId})`,
        )
        allToolCalls.set(part.toolCallId, part)
        const idx = currentStepToolCalls.findIndex(
          (tc) => tc.toolCallId === part.toolCallId,
        )
        if (idx !== -1) currentStepToolCalls[idx] = part
        else currentStepToolCalls.push(part)
        break
      }
      case 'tool-result': {
        console.log(
          `[Messenger] tool-result: ${part.toolName} (output: ${String(part.output).slice(0, 100)})`,
        )
        flushAssistant()
        if (loopMessages.length > 0) {
          const last = loopMessages[loopMessages.length - 1]
          const parts = [...last.parts]
          const idx = parts.findIndex(
            (p: any) =>
              p.type === 'dynamic-tool' && p.toolCallId === part.toolCallId,
          )
          if (idx !== -1) {
            parts[idx] = {
              ...parts[idx],
              state: 'output-available',
              output: part.output,
            } as any
            loopMessages[loopMessages.length - 1] = { ...last, parts }
          }
        }
        break
      }
      case 'command-output' as any: {
        const cmdText = (part as any).text
        console.log(`[Messenger] command-output: ${cmdText.slice(0, 100)}`)
        if (cmdText && loopMessages.length > 0) {
          const last = loopMessages[loopMessages.length - 1]
          const parts = [...last.parts]
          for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i] as any
            if (
              p.type === 'dynamic-tool' &&
              p.toolName === 'run_command' &&
              (p.state === 'input-available' || p.state === 'executing')
            ) {
              parts[i] = {
                ...p,
                state: 'executing',
                output: (p.output || '') + cmdText,
              } as any
              loopMessages[loopMessages.length - 1] = { ...last, parts }
              break
            }
          }
        }
        break
      }
      case 'finish-step': {
        console.log(
          `[Messenger] finish-step: textAccum=${textAccum.length} chars, toolCalls=${currentStepToolCalls.length}`,
        )
        flushAssistant()
        const incrementalMessages = [...messages, ...loopMessages]
        if (botSession) {
          await saveBotSession(
            botSession.messengerId,
            botSession.chatName,
            incrementalMessages,
          ).catch((err: any) =>
            console.error('[Messenger] bot incremental save failed:', err),
          )
        } else {
          await saveSession(
            workspaceName,
            sessionId,
            incrementalMessages,
            undefined,
          ).catch((err: any) =>
            console.error('[Messenger] incremental save failed:', err),
          )
        }
        break
      }
      case 'error':
        console.log(`[Messenger] error: ${part.error}`)
        flushAssistant()
        throw new Error(String(part.error))
      case 'finish':
        console.log(
          `[Messenger] finish: total steps=${stepCount}, loopMessages=${loopMessages.length}`,
        )
        flushAssistant()
        break
    }
  }

  const resultMessages = [...messages, ...loopMessages]
  const lastAssistant = [...loopMessages]
    .reverse()
    .find((m) => m.role === 'assistant')
  console.log(
    `[Messenger] agent loop returning ${resultMessages.length} messages, last assistant has ${lastAssistant?.parts?.length || 0} parts`,
  )

  return resultMessages
}

// ─── Help: Agent + Agent Info Loading ─────────────────────────────────────

/** Load an agent file from the agents directory by ID. */
async function loadAgent(
  agentId: string,
): Promise<{ name: string; introduction?: string } | null> {
  try {
    const agent = await readJson<{
      name: string
      introduction?: string
    }>(getAgentPath(agentId))
    return agent
  } catch {
    return null
  }
}

/** List all available agent IDs from the agents directory. */
function listAgentIds(): string[] {
  try {
    return readdirSync(getAgentsDir())
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
  } catch {
    return []
  }
}

/** Collect all unique project folders across all workspaces. */
async function listAllProjectFolders(): Promise<string[]> {
  const wsConfig = await readJson<{ active: string; list: string[] }>(
    getWorkspacesConfigPath(),
    { active: 'Aynite', list: ['Aynite'] },
  )
  const allFolders = new Set<string>()
  for (const ws of wsConfig.list) {
    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(ws),
    ).catch(() => null)
    if (workspaceConfig?.folders) {
      for (const f of workspaceConfig.folders) {
        allFolders.add(f)
      }
    }
  }
  return Array.from(allFolders)
}

// ─── Command: /help, /?, /h ─────────────────────────────────────────────

export async function handleHelp(
  config: MessengerConfig,
  ctx: MessengerContext,
) {
  const lines: string[] = []
  lines.push('*Aynite Bot*')
  lines.push('')

  // Agent info
  if (config.agentId) {
    const agent = await loadAgent(config.agentId)
    if (agent) {
      lines.push(`*Agent:* ${escapeMarkdown(agent.name)}`)
      if (agent.introduction) {
        lines.push(`${escapeMarkdown(agent.introduction)}`)
      }
    } else {
      lines.push('*Agent:* Not found')
    }
  } else {
    lines.push('*Agent:* Not bound. Use `/set-agent` to bind an agent.')
  }

  // Project folder
  if (config.projectFolder) {
    lines.push(`*Project:* \`${escapeMarkdown(config.projectFolder)}\``)
  } else {
    lines.push(
      '*Project:* Not set. Use `/set-project` to set a working project folder.',
    )
  }

  lines.push('')
  lines.push('---')
  lines.push('*Commands:*')
  lines.push('`/help`, `/?`, `/h` — Show this message')
  lines.push('`/set-project` — Set working project folder')
  lines.push('`/set-agent` — Set bound agent')
  lines.push('')
  lines.push('Send any other message to chat with the AI agent.')

  await ctx.replyWithMarkdown(lines.join('\n'))
}

// ─── Command: /set-project ──────────────────────────────────────────────

export async function handleSetProject(
  config: MessengerConfig,
  ctx: MessengerContext,
  args: string,
) {
  const folders = await listAllProjectFolders()

  if (!args) {
    // No index provided — list available projects
    if (folders.length === 0) {
      await ctx.reply('No project folders found in any workspace.')
      return
    }
    const lines: string[] = ['*Available project folders:*', '']
    folders.forEach((f, i) => {
      lines.push(`*${i + 1}.* \`${escapeMarkdown(f)}\``)
    })
    lines.push('')
    lines.push('Reply with `/set-project <index>` to select a project folder.')
    await ctx.replyWithMarkdown(lines.join('\n'))
    return
  }

  // Index provided — try to set
  const index = parseInt(args, 10)
  if (Number.isNaN(index) || index < 1 || index > folders.length) {
    await ctx.reply(
      `Invalid index. Choose a number between 1 and ${folders.length}. Use \`/set-project\` to see the list.`,
    )
    return
  }

  const selected = folders[index - 1]

  // Update the config in messengers.json
  try {
    const configs = await loadConfigs()
    const updated = configs.map((c) =>
      c.id === config.id ? { ...c, projectFolder: selected } : c,
    )
    await saveConfigsDirect(updated)
    await ctx.replyWithMarkdown(
      `*Project folder set*\n\n\`${escapeMarkdown(selected)}\``,
    )
  } catch (err) {
    console.error('[Messenger] Failed to save project folder:', err)
    await ctx.reply('Failed to save project folder.')
  }
}

// ─── Command: /set-agent ────────────────────────────────────────────────

export async function handleSetAgent(
  config: MessengerConfig,
  ctx: MessengerContext,
  args: string,
) {
  const agentIds = listAgentIds()

  if (!args) {
    // No index provided — list available agents
    if (agentIds.length === 0) {
      await ctx.reply('No agents found.')
      return
    }
    const lines: string[] = ['*Available agents:*', '']
    for (let i = 0; i < agentIds.length; i++) {
      const agent = await loadAgent(agentIds[i])
      const name = agent?.name || agentIds[i]
      lines.push(`*${i + 1}.* ${escapeMarkdown(name)}`)
    }
    lines.push('')
    lines.push('Reply with `/set-agent <index>` to select an agent.')
    await ctx.replyWithMarkdown(lines.join('\n'))
    return
  }

  // Index provided — try to set
  const index = parseInt(args, 10)
  if (Number.isNaN(index) || index < 1 || index > agentIds.length) {
    await ctx.reply(
      `Invalid index. Choose a number between 1 and ${agentIds.length}. Use \`/set-agent\` to see the list.`,
    )
    return
  }

  const selectedId = agentIds[index - 1]
  const agent = await loadAgent(selectedId)
  const agentName = agent?.name || selectedId

  // Update the config in messengers.json
  try {
    const configs = await loadConfigs()
    const updated = configs.map((c) =>
      c.id === config.id ? { ...c, agentId: selectedId } : c,
    )
    await saveConfigsDirect(updated)
    await ctx.replyWithMarkdown(
      `*Agent set*\n\nBound to: ${escapeMarkdown(agentName)}`,
    )
  } catch (err) {
    console.error('[Messenger] Failed to save agent:', err)
    await ctx.reply('Failed to save agent.')
  }
}

// ─── Command: Chat Message ──────────────────────────────────────────────

export async function handleChatMessage(
  config: MessengerConfig,
  ctx: MessengerContext,
  text: string,
  /** Chat name for per-channel sessions, e.g. '@username' (DM) or '#general' (group) */
  chatName?: string,
  /** Display name of the sender (e.g. '@john' or 'John Doe') */
  senderLabel?: string,
  /** Optional recent group context lines to inject as separate messages */
  groupContextLines?: string[],
) {
  const workspace = await getActiveWorkspace()
  const chat = chatName || 'default'
  const lockKey = lockBot(config.id, chat)

  try {
    console.log(
      `[Messenger] handleChatMessage: provider="${config.provider}" workspace="${workspace}" text="${text.slice(0, 100)}" chatName="${chatName}"`,
    )

    // ── Guard: agent and project folder must be set ──────────────────────

    if (!config.agentId) {
      await ctx.reply(
        'No agent is bound to this bot. Use `/set-agent` to choose an agent, then try again.',
      )
      return
    }
    if (!config.projectFolder) {
      await ctx.reply(
        'No project folder is set for this bot. Use `/set-project` to choose one, then try again.',
      )
      return
    }

    // ── Determine chat name ──────────────────────────────────────────────

    const chat = chatName || 'default'

    // ── Save incoming message to chat history ────────────────────────────

    await saveBotMessage(config.id, chat, 'user', 'User', text)

    // ── Resolve session ID ───────────────────────────────────────────────

    const sessionId = getOrCreateBotSessionId(config.id, chat)

    // ── Load existing session messages ───────────────────────────────────

    const messages = await loadBotSessionMessages(config.id, chat)
    console.log(`[Messenger] loaded ${messages.length} existing messages`)

    // ── Load configs ─────────────────────────────────────────────────────

    const [aiConfig, mainConfig] = await Promise.all([
      loadAiConfig(),
      loadMainConfig(),
    ])

    const toolsConfig = mainConfig?.aiTools || {}
    const activeAgentId = config.agentId
    const workspaceFolders = [config.projectFolder]

    // ── Resolve agent ────────────────────────────────────────────────────

    const agentFile = await loadAgent(activeAgentId)
    const activeAgent = agentFile || null

    const activeProvider =
      aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
      aiConfig?.providers?.[0]

    // ── Build message array ──────────────────────────────────────────────

    const updatedMessages: UIMessage[] = [...messages]
    if (
      updatedMessages.length === 0 ||
      !updatedMessages.some((m: any) => m.role === 'system')
    ) {
      const { getMergedSystemPrompt } = await import('../ai')
      const agentPrompt = await getMergedSystemPrompt(activeAgentId)
      // Append a bot-forwarding instruction so the AI understands the context.
      // The AI is not talking to the end user directly — messages are forwarded
      // by a messenger bot that wraps them with sender/timestamp metadata.
      const BOT_INSTRUCTION = [
        "You are communicating through a messenger bot. The user's messages are forwarded to you with sender and timestamp metadata.",
        '',
        "You have access to a `get_messages` tool that can fetch history from the chat's message log.",
        "Use `get_messages` only when necessary to understand the user's request — for example, if a group chat user asks you to summarize a discussion or create action items based on earlier conversation.",
        'IMPORTANT: After using `get_messages` to read history, you MUST ask the user to confirm whether you understood the context correctly before proceeding with any action.',
        '',
        'You also have a `notify_user` tool that sends a message to the user.',
        'Reply directly to the user whenever possible — your text response is automatically sent back.',
        'Use `notify_user` only when you cannot answer immediately and need time to work (e.g. running long commands, researching).',
        'When using `notify_user`, send a brief message like "Working on it, I\'ll get back to you" so the user knows the request is being handled.',
        '',
        'Respond conversationally to the content of the message, addressing the sender directly.',
      ].join('\n')
      const systemPrompt = agentPrompt
        ? `${agentPrompt}\n\n${BOT_INSTRUCTION}`
        : BOT_INSTRUCTION
      if (systemPrompt) {
        updatedMessages.unshift({
          id: genId(),
          role: 'system',
          parts: [{ type: 'text', text: systemPrompt }],
        })
        console.log(
          `[Messenger] added system prompt (${systemPrompt.length} chars)`,
        )
      }
    }

    const now = new Date().toISOString()

    // Inject group context as separate user messages (before the current message)
    // so the AI sees them as distinct conversation turns.
    if (groupContextLines && groupContextLines.length > 0) {
      for (const line of groupContextLines) {
        const ctxMsg: UIMessage = {
          id: genId(),
          role: 'user',
          parts: [{ type: 'text', text: line }],
        }
        updatedMessages.push(ctxMsg)
      }
    }

    const formattedText = `- sender: ${senderLabel || 'Unknown'}
- timestamp: ${now}
- content: ${text}`
    const userMsg: UIMessage = {
      id: genId(),
      role: 'user',
      parts: [{ type: 'text', text: formattedText }],
    }
    updatedMessages.push(userMsg)
    console.log(
      `[Messenger] total messages before agent loop: ${updatedMessages.length}`,
    )

    // No auto-reply — the AI will either reply directly in its text response
    // or use the notify_user tool if it needs time to work.

    const activeFile = '' // Bot doesn't have an active file
    const finalMessages = await runMessengerAgent(
      updatedMessages,
      workspace,
      workspaceFolders,
      activeFile,
      toolsConfig,
      () => {},
      sessionId,
      {
        messengerId: config.id,
        chatName: chat,
        reply: (text: string) => ctx.reply(text),
      },
    )

    console.log(
      `[Messenger] agent loop finished, total messages: ${finalMessages.length}`,
    )

    const existingMeta = await loadBotSessionMetadata(config.id, chat)
    const agentName = activeAgent?.name || 'Chat'
    const modelName = activeProvider?.name || activeProvider?.model || 'AI'
    const metadata: SessionMetadata = {
      agentName,
      modelName,
      createdAt: existingMeta?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await saveBotSession(config.id, chat, finalMessages, metadata)
    console.log(`[Messenger] bot session saved: ${chat}/session/`)

    const lastAssistant = [...finalMessages]
      .reverse()
      .find(
        (m: any) =>
          m.role === 'assistant' &&
          m.parts?.some((p: any) => p.type === 'text'),
      )
    let replyText = 'Done.'
    if (lastAssistant) {
      const textPart = lastAssistant.parts.find((p: any) => p.type === 'text')
      if (textPart) replyText = (textPart as any).text
    }

    // Save assistant reply to chat history too
    await saveBotMessage(config.id, chat, 'assistant', 'Bot', replyText)

    console.log(`[Messenger] replying with ${replyText.length} chars`)
    await ctx.reply(replyText)
  } catch (err) {
    console.error(`[Messenger] Chat error for "${config.provider}":`, err)
    await ctx.reply('An error occurred while processing your request.')
  } finally {
    unlockBot(lockKey)
    console.log(`[Messenger] processing lock released for "${config.provider}"`)
  }
}

// ─── Bot Registry ────────────────────────────────────────────────────────

export function getBot(id: string): BotHandle | undefined {
  return bots.get(id)
}

export function setBot(id: string, handle: BotHandle) {
  bots.set(id, handle)
}

export function deleteBot(id: string) {
  bots.delete(id)
}

export function hasBot(id: string): boolean {
  return bots.has(id)
}

export function getAllBotIds(): string[] {
  return Array.from(bots.keys())
}

/**
 * Build a per-chat lock key from messenger ID and chat name.
 * This ensures concurrent messages to different chats don't block each other.
 */
export function getBotLockKey(messengerId: string, chatName: string): string {
  return `${messengerId}:${chatName}`
}

/**
 * Check if a bot is busy processing a message for a specific chat.
 * If busy, returns a reply string with the last assistant message content
 * (or a generic message if no last message exists). Returns null if not busy.
 */
export async function getBusyReply(
  messengerId: string,
  chatName: string,
): Promise<string | null> {
  const lockKey = getBotLockKey(messengerId, chatName)
  if (!processing.has(lockKey)) return null

  let lastContent = ''
  try {
    const msgs = await loadBotSessionMessages(messengerId, chatName)
    if (msgs && Array.isArray(msgs)) {
      const lastAssistant = [...msgs]
        .reverse()
        .find((m: any) => m.role === 'assistant' && m.parts?.length > 0)

      if (lastAssistant) {
        const lines: string[] = []
        for (const part of lastAssistant.parts) {
          if (part.type === 'text' && part.text) {
            lines.push(part.text.slice(0, 2000))
          }
          if (
            part.type === 'dynamic-tool' ||
            part.type === 'tool-call' ||
            part.type === 'tool-result'
          ) {
            const p = part as any
            const toolName = p.toolName || ''
            const input = p.input ?? p.args ?? {}
            const formattedName = toolName.toUpperCase().replace(/_/g, ' ')
            const actualArgs = input?.args || input?.input || input
            const getCmd = (obj: any): string | null => {
              if (!obj || typeof obj !== 'object') return null
              return (
                obj.command ||
                obj.path ||
                obj.pattern ||
                obj.url ||
                obj.query ||
                obj.name ||
                null
              )
            }
            let cmd = getCmd(actualArgs)
            if (cmd && toolName === 'run_command') {
              cmd = cmd.replace(/^cd\s+\S+(\s*[;&|]{1,2}\s*)?/, '').trim()
            }
            if (cmd) {
              lines.push(`⚡ ${formattedName}  │  ${cmd}`)
            } else {
              lines.push(`⚡ ${formattedName}`)
            }
          }
        }
        if (lines.length > 0) {
          lastContent = lines.join('\n\n').slice(0, 2000)
        }
      }
    }
  } catch {
    // Best effort
  }

  return lastContent
    ? `The agent is busy with the last request.\n\nHere is the latest message from the session:\n\n${escapeMarkdown(lastContent)}`
    : 'The agent is currently processing a request. Please wait before sending another message.'
}

/**
 * Mark a bot chat as busy (locked). Returns the lock key for later release.
 */
export function lockBot(messengerId: string, chatName: string): string {
  const lockKey = getBotLockKey(messengerId, chatName)
  processing.add(lockKey)
  return lockKey
}

/**
 * Release (unlock) a bot chat that was previously locked.
 */
export function unlockBot(lockKey: string) {
  processing.delete(lockKey)
}
