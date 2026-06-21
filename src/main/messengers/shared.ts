/**
 * Shared messenger logic — provider-agnostic command handlers, agent loop,
 * group message buffering, and lifecycle helpers.
 *
 * Each provider adapter (Telegram, Discord) implements the `MessengerContext`
 * interface and delegates to these shared functions.
 */

import { readdirSync } from 'node:fs'
import type { UIMessage } from 'ai'
import { AppEvents } from '../../lib/constants/app'
import type { WorkspaceConfig } from '../../lib/constants/types'
import {
  getAgentPath,
  getAgentsDir,
  getAIConfigPath,
  getMainConfigPath,
  getMessengersConfigPath,
  getSessionMessagesPath,
  getSessionMetadataFilePath,
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
import { broadcastAppEvent } from '../ipc-utils'
import { saveWorkspaceState } from '../workspace'

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

async function findMetadata(
  sessionId: string,
  workspace: string,
): Promise<{ metadata: SessionMetadata | null; dateDir: string | null }> {
  const metaPath = getSessionMetadataFilePath(sessionId, workspace)
  const meta = await readJson<SessionMetadata>(metaPath).catch(() => null)
  return { metadata: meta, dateDir: null }
}

async function findSessionFile(sessionId: string, workspace: string) {
  const path = getSessionMessagesPath(sessionId, workspace)
  return readJson(path).catch(() => null)
}

function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const PROCESSING_REPLIES = [
  'Gotcha, working on it',
  'Diving into it, will get back to you soon',
  'On it! Let me look into that for you',
  'Alright, give me a moment to figure this out',
  'Let me work through that, hang tight',
  'One sec, let me dig into that',
  "Sure thing, I'll get right on it",
  'Lemme take a look and get back to you',
  'Processing your request, stay tuned',
  'Working through it now, will let you know',
]

function randomProcessingReply(): string {
  return PROCESSING_REPLIES[
    Math.floor(Math.random() * PROCESSING_REPLIES.length)
  ]
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
        await saveSession(
          workspaceName,
          sessionId,
          incrementalMessages,
          undefined,
        ).catch((err: any) =>
          console.error('[Messenger] incremental save failed:', err),
        )
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
) {
  const workspace = await getActiveWorkspace()
  const lockKey = `${config.id}:${workspace}`

  if (processing.has(lockKey)) {
    let lastContent = ''
    try {
      const wsConfig = await readJson<WorkspaceConfig>(
        getWorkspaceDataPath(workspace),
      )
      const botId = wsConfig.activeSessionIdForBot || wsConfig.activeSessionId
      if (botId) {
        const msgs = await findSessionFile(botId, workspace)
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
                const toolName = part.toolName || ''
                const input = part.input ?? part.args ?? {}
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
      }
    } catch {
      // Best effort
    }

    const message = lastContent
      ? `The agent is busy with the last request.\n\nHere is the latest message from the session:\n\n${escapeMarkdown(lastContent)}`
      : 'The agent is currently processing a request. Please wait before sending another message.'

    await ctx.reply(message)
    return
  }

  processing.add(lockKey)

  try {
    console.log(
      `[Messenger] handleChatMessage: provider="${config.provider}" workspace="${workspace}" text="${text.slice(0, 100)}"`,
    )

    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(workspace),
    )
    if (!workspaceConfig) {
      await ctx.reply(`Workspace "${workspace}" not found.`)
      return
    }

    const { activeSessionId, activeSessionIdForBot } = workspaceConfig
    const activeAgentId = config.agentId || workspaceConfig.activeAgentId
    const workspaceFolders = config.projectFolder
      ? [config.projectFolder]
      : workspaceConfig.folders

    const botSessionId = activeSessionIdForBot || activeSessionId
    console.log(
      `[Messenger] workspace: activeSessionId="${activeSessionId}" activeSessionIdForBot="${activeSessionIdForBot}" botSessionId="${botSessionId}" agentId="${activeAgentId}" folders=${workspaceFolders?.length}`,
    )

    let sessionId: string
    if (!botSessionId) {
      sessionId = Date.now().toString()
      await saveSession(workspace, sessionId, [], undefined)
      await saveWorkspaceState(workspace, {
        activeSessionIdForBot: sessionId,
      })
      broadcastAppEvent(AppEvents.CONFIG_CHANGED, {
        key: 'activeSessionIdForBot',
      })
      console.log(`[Messenger] created new bot session: ${sessionId}`)
    } else {
      sessionId = botSessionId
    }

    let messages = await findSessionFile(sessionId, workspace)
    if (!messages || !Array.isArray(messages)) {
      messages = []
    }
    console.log(`[Messenger] loaded ${messages.length} existing messages`)

    const [aiConfig, mainConfig] = await Promise.all([
      loadAiConfig(),
      loadMainConfig(),
    ])

    const toolsConfig = mainConfig?.aiTools || {}
    const agentsConfig = mainConfig?.agents || { list: [] }
    const activeAgent = agentsConfig.list?.find(
      (a: any) => a.id === activeAgentId,
    )

    const activeProvider =
      aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
      aiConfig?.providers?.[0]

    const updatedMessages: UIMessage[] = [...messages]
    if (
      updatedMessages.length === 0 ||
      !updatedMessages.some((m: any) => m.role === 'system')
    ) {
      const { getMergedSystemPrompt } = await import('../ai')
      const systemPrompt = await getMergedSystemPrompt(activeAgent?.id)
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

    const userMsg: UIMessage = {
      id: genId(),
      role: 'user',
      parts: [{ type: 'text', text }],
    }
    updatedMessages.push(userMsg)
    console.log(
      `[Messenger] total messages before agent loop: ${updatedMessages.length}`,
    )

    await ctx.reply(randomProcessingReply())

    const activeFile = workspaceConfig.activeFile || ''
    const finalMessages = await runMessengerAgent(
      updatedMessages,
      workspace,
      workspaceFolders,
      activeFile,
      toolsConfig,
      () => {},
      sessionId,
    )

    console.log(
      `[Messenger] agent loop finished, total messages: ${finalMessages.length}`,
    )

    const existingMeta = await findMetadata(sessionId, workspace)
    const agentName = activeAgent?.name || 'Chat'
    const modelName = activeProvider?.name || activeProvider?.model || 'AI'
    const metadata: SessionMetadata = {
      agentName,
      modelName,
      createdAt: existingMeta.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await saveSession(workspace, sessionId, finalMessages, metadata)
    console.log(`[Messenger] session saved (with metadata): ${sessionId}`)

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

    console.log(`[Messenger] replying with ${replyText.length} chars`)
    await ctx.reply(replyText)
  } catch (err) {
    console.error(`[Messenger] Chat error for "${config.provider}":`, err)
    await ctx.reply('An error occurred while processing your request.')
  } finally {
    processing.delete(lockKey)
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
