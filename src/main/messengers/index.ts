/**
 * Messenger Runtime — manages Telegram bot polling across configured messengers.
 *
 * Each bot reads its own config (workspace binding) and handles commands:
 * - "?" → replies with workspace information (name, folders, active session details, available commands)
 * - "/summarize" → summarizes the active session and updates metadata title/description
 * - any other text → sends the message to the AI agent loop and replies with the result
 */

import type { UIMessage } from 'ai'
import type { WorkspaceConfig } from '../../lib/constants/types'
import {
  getAIConfigPath,
  getMainConfigPath,
  getMessengersConfigPath,
  getSessionMetadataPath,
  getSessionPath,
  getWorkspaceDataPath,
  getWorkspaceSessionsDir,
  readdir,
  readJson,
  writeJson,
} from '../../lib/path'
import type { MessengerConfig } from '../../lib/types/ai'
import type { SessionMetadata } from '../../lib/types/chat'
import { getProviderReasoningOptions } from '../ai/chat'
import { getAIModel } from '../ai/factory'
import { createTools } from '../ai/tools'

const bots = new Map<string, import('telegraf').Telegraf>()
// Track which bot sessions are currently processing a message
const processing = new Set<string>()

function loadConfigs(): Promise<MessengerConfig[]> {
  return readJson<MessengerConfig[]>(getMessengersConfigPath(), [])
}

function loadAiConfig() {
  return readJson<any>(getAIConfigPath())
}

function loadMainConfig() {
  return readJson<any>(getMainConfigPath())
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function escapeMarkdown(text: string): string {
  return text.replace(/[_*`[]/g, '\\$&')
}

async function findMetadata(
  sessionId: string,
  workspace: string,
): Promise<{ metadata: SessionMetadata | null; dateDir: string | null }> {
  const sessionsDir = getWorkspaceSessionsDir(workspace)
  const dates = await readdir(sessionsDir).catch(() => [])
  for (const d of dates) {
    if (!d.isDirectory()) continue
    const metaPath = getSessionMetadataPath(sessionId, d.name, workspace)
    const meta = await readJson<SessionMetadata>(metaPath).catch(() => null)
    if (meta) return { metadata: meta, dateDir: d.name }
  }
  return { metadata: null, dateDir: null }
}

async function findSessionFile(sessionId: string, workspace: string) {
  const sessionsDir = getWorkspaceSessionsDir(workspace)
  const dates = await readdir(sessionsDir).catch(() => [])
  for (const d of dates) {
    if (!d.isDirectory()) continue
    const sessionPath = getSessionPath(sessionId, d.name, workspace)
    const content = await readJson(sessionPath).catch(() => null)
    if (content) return content
  }
  return null
}

function genId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ─── Agent Loop (main process version) ──────────────────────────────────

/**
 * Run the full agent loop for a given set of messages, using the active
 * AI provider and enabled tools. Collects all assistant messages and tool
 * results, saves the updated session, and returns the last assistant text.
 *
 * Tools run without approval prompts (auto-approved for messenger use).
 * The `onCommandProgress` callback streams command output back to the user.
 */
async function runMessengerAgent(
  messages: UIMessage[],
  workspaceName: string,
  workspaceFolders: string[],
  activeFile: string,
  enabledTools: Record<string, boolean>,
  onProgress: (text: string) => void,
): Promise<UIMessage[]> {
  const aiConfig = await loadAiConfig()
  const activeProvider =
    aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
    aiConfig?.providers?.[0]

  if (!activeProvider) throw new Error('No active AI provider configured')

  const { streamText, convertToModelMessages, stepCountIs } = await import('ai')
  const model = getAIModel(activeProvider)

  // Separate system message
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

  // Create tools with command progress callback for streaming output
  const toolContext = {
    workspaceFolders,
    activeFile,
    workspaceName,
    onCommandProgress: (text: string) => onProgress(text),
  }
  const tools = createTools(toolContext)

  const result = streamText({
    model,
    system,
    messages: modelMessages,
    tools,
    // Allow up to 100 steps (tool call rounds) — prevents infinite loops
    stopWhen: stepCountIs(100),
    providerOptions: getProviderReasoningOptions(activeProvider) as any,
  })

  const loopMessages: UIMessage[] = []
  let textAccum = ''
  let reasoningAccum = ''
  const allToolCalls = new Map<string, any>()
  let currentStepToolCalls: any[] = []

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
      case 'text-delta':
        textAccum += part.text
        break
      case 'reasoning-delta':
        reasoningAccum += part.text
        break
      case 'tool-call': {
        allToolCalls.set(part.toolCallId, part)
        const idx = currentStepToolCalls.findIndex(
          (tc) => tc.toolCallId === part.toolCallId,
        )
        if (idx !== -1) currentStepToolCalls[idx] = part
        else currentStepToolCalls.push(part)
        break
      }
      case 'tool-result': {
        flushAssistant()
        // Update the matching tool part in the last assistant message
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
      case 'command-output': {
        const text = (part as any).text
        if (text && loopMessages.length > 0) {
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
                output: (p.output || '') + text,
              } as any
              loopMessages[loopMessages.length - 1] = { ...last, parts }
              break
            }
          }
        }
        break
      }
      case 'error':
        flushAssistant()
        throw new Error(String(part.error))
      case 'finish':
        flushAssistant()
        break
    }
  }

  return [...messages, ...loopMessages]
}

// ─── Command Handlers ────────────────────────────────────────────────────

async function handleWorkspaceInfo(config: MessengerConfig, ctx: any) {
  try {
    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(config.workspace),
    )
    if (!workspaceConfig) {
      await ctx.reply(`Workspace "${config.workspace}" not found.`)
      return
    }

    const { activeSessionId, activeAgentId, folders } = workspaceConfig

    const lines: string[] = []
    lines.push(`*Workspace:* ${escapeMarkdown(config.workspace)}`)
    lines.push(`*Agent:* ${escapeMarkdown(activeAgentId || 'N/A')}`)
    lines.push('')

    lines.push(`*Folders (${folders?.length || 0}):*`)
    if (folders && folders.length > 0) {
      for (const f of folders) lines.push(`  ${escapeMarkdown(f)}`)
    } else {
      lines.push('  _(none)_')
    }

    if (activeSessionId) {
      lines.push('')
      lines.push(`*Active Session:* \`${activeSessionId}\``)

      const { metadata: foundMetadata } = await findMetadata(
        activeSessionId,
        config.workspace,
      )

      if (foundMetadata) {
        const title = escapeMarkdown(
          foundMetadata.title ||
            `${foundMetadata.agentName || 'Unknown'} - ${foundMetadata.modelName || 'Unknown'}`,
        )
        if (foundMetadata.description) {
          lines.push(`*Title:* ${title}`)
          lines.push(
            `*Description:* ${escapeMarkdown(foundMetadata.description)}`,
          )
        } else {
          const sessionContent = await findSessionFile(
            activeSessionId,
            config.workspace,
          )
          const firstUser = sessionContent?.find((m: any) => m.role === 'user')
          const preview =
            firstUser?.parts
              ?.map((p: any) => p.text || '')
              .join('')
              ?.slice(0, 80) || '_(no messages)_'
          lines.push(`*Title:* ${title}`)
          lines.push(`*Description:* ${escapeMarkdown(preview)}`)
        }
      } else {
        lines.push(`*Session:* \`${activeSessionId}\` _(no metadata)_`)
      }
    } else {
      lines.push('')
      lines.push('*Active Session:* _(none)_')
    }

    lines.push('')
    lines.push('---')
    lines.push('*Commands:*')
    lines.push('`?` — Show workspace info')
    lines.push('`/summarize` — Summarize active session')
    lines.push('`/new-session` — Create a new empty session')
    lines.push('`/list-sessions` — List last 10 sessions')
    lines.push('`/switch-session <index>` — Switch to a session by index')

    await ctx.replyWithMarkdown(lines.join('\n'))
  } catch (err) {
    console.error(`[Messenger] Workspace info error for "${config.name}":`, err)
    await ctx.reply('Failed to load workspace info.')
  }
}

async function handleSummarize(config: MessengerConfig, ctx: any) {
  try {
    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(config.workspace),
    )
    if (!workspaceConfig) {
      await ctx.reply(`Workspace "${config.workspace}" not found.`)
      return
    }

    const { activeSessionId } = workspaceConfig
    if (!activeSessionId) {
      await ctx.reply('No active session.')
      return
    }

    const messages = await findSessionFile(activeSessionId, config.workspace)
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      await ctx.reply('Active session is empty.')
      return
    }

    await ctx.reply('Summarizing session...')

    const chatMessages = messages.filter((m: any) => m.role !== 'system')
    const summaryPrompt =
      'Please summarize the above conversation concisely, preserving all key information, decisions, and context. Focus on the essential points that would be needed to continue the conversation.'

    const summaryMessages = [
      ...chatMessages,
      {
        id: 'summarize-req',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: summaryPrompt }],
      },
    ]

    const aiConfig = await loadAiConfig()
    const activeProvider =
      aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
      aiConfig?.providers?.[0]

    if (!activeProvider) {
      await ctx.reply('No active AI provider configured.')
      return
    }

    const { streamText, convertToModelMessages } = await import('ai')
    const model = getAIModel(activeProvider)
    const modelMessages = await convertToModelMessages(summaryMessages, {
      tools: {},
      ignoreIncompleteToolCalls: true,
    })

    let summaryText = ''
    const result = streamText({ model, messages: modelMessages, tools: {} })

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') summaryText += part.text
      if (part.type === 'error') {
        await ctx.reply(`Summarization failed: ${part.error}`)
        return
      }
    }

    const lines = summaryText.split('\n').filter((l: string) => l.trim())
    const firstLine = lines[0]?.trim() || ''
    const title =
      firstLine.replace(/^#+\s*/, '').slice(0, 100) || 'Conversation Summary'

    const { metadata: existingMeta, dateDir } = await findMetadata(
      activeSessionId,
      config.workspace,
    )
    if (dateDir) {
      const metaPath = getSessionMetadataPath(
        activeSessionId,
        dateDir,
        config.workspace,
      )
      await writeJson(metaPath, {
        ...(existingMeta || {}),
        title,
        description: summaryText,
        updatedAt: new Date().toISOString(),
      })
    }

    await ctx.replyWithMarkdown(
      `*Session summarized*\n\n*Title:* ${escapeMarkdown(title)}\n*Description:* ${escapeMarkdown(summaryText.slice(0, 200))}...`,
    )
  } catch (err) {
    console.error(`[Messenger] Summarize error for "${config.name}":`, err)
    await ctx.reply('Failed to summarize session.')
  }
}

async function handleNewSession(config: MessengerConfig, ctx: any) {
  try {
    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(config.workspace),
    )
    if (!workspaceConfig) {
      await ctx.reply(`Workspace "${config.workspace}" not found.`)
      return
    }

    const newId = Date.now().toString()
    const sessionPath = getSessionPath(newId, undefined, config.workspace)
    await writeJson(sessionPath, [])
    workspaceConfig.activeSessionId = newId
    await writeJson(getWorkspaceDataPath(config.workspace), workspaceConfig)

    await ctx.replyWithMarkdown(`*New session created*\n\nID: \`${newId}\``)
  } catch (err) {
    console.error(`[Messenger] New session error for "${config.name}":`, err)
    await ctx.reply('Failed to create new session.')
  }
}

async function handleListSessions(config: MessengerConfig, ctx: any) {
  try {
    const { listSessions } = await import('../ai/chat')
    const sessions = await listSessions(config.workspace)

    if (!sessions || sessions.length === 0) {
      await ctx.reply('No sessions found.')
      return
    }

    const top = sessions.slice(0, 10)
    const lines: string[] = ['*Last 10 sessions:*', '']
    top.forEach((s: any, i: number) => {
      const title = s.title || `Session ${s.id.slice(-6)}`
      const desc = s.preview
        ? escapeMarkdown(s.preview.slice(0, 60))
        : '_(no description)_'
      lines.push(`*${i + 1}.* ${escapeMarkdown(title)}`)
      lines.push(`   ${desc}`)
    })

    await ctx.replyWithMarkdown(lines.join('\n'))
  } catch (err) {
    console.error(`[Messenger] List sessions error for "${config.name}":`, err)
    await ctx.reply('Failed to list sessions.')
  }
}

async function handleSwitchSession(
  config: MessengerConfig,
  ctx: any,
  args: string,
) {
  try {
    const index = parseInt(args, 10)
    if (Number.isNaN(index) || index < 1) {
      await ctx.reply(
        'Please provide a valid session index (e.g. `/switch-session 2`).',
      )
      return
    }

    const { listSessions } = await import('../ai/chat')
    const sessions = await listSessions(config.workspace)

    if (!sessions || sessions.length === 0) {
      await ctx.reply('No sessions found.')
      return
    }

    const target = sessions[index - 1]
    if (!target) {
      await ctx.reply(
        `Session index ${index} not found. Use /list-sessions to see available sessions.`,
      )
      return
    }

    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(config.workspace),
    )
    if (!workspaceConfig) {
      await ctx.reply(`Workspace "${config.workspace}" not found.`)
      return
    }

    workspaceConfig.activeSessionId = target.id
    await writeJson(getWorkspaceDataPath(config.workspace), workspaceConfig)

    const title = target.title || `Session ${target.id.slice(-6)}`
    await ctx.replyWithMarkdown(
      `*Switched to session*\n\n*Title:* ${escapeMarkdown(title)}\n*ID:* \`${target.id}\``,
    )
  } catch (err) {
    console.error(`[Messenger] Switch session error for "${config.name}":`, err)
    await ctx.reply('Failed to switch session.')
  }
}

async function handleChatMessage(
  config: MessengerConfig,
  ctx: any,
  text: string,
) {
  const lockKey = `${config.id}:${config.workspace}`

  // If the agent is already processing a message for this bot, reject
  if (processing.has(lockKey)) {
    await ctx.reply(
      'The agent is currently processing a request. Please wait before sending another message.',
    )
    return
  }

  processing.add(lockKey)

  try {
    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(config.workspace),
    )
    if (!workspaceConfig) {
      await ctx.reply(`Workspace "${config.workspace}" not found.`)
      return
    }

    let {
      activeSessionId,
      activeAgentId,
      folders: workspaceFolders,
    } = workspaceConfig
    if (!activeSessionId) {
      // Create a new session
      activeSessionId = Date.now().toString()
      const sessionPath = getSessionPath(
        activeSessionId,
        undefined,
        config.workspace,
      )
      await writeJson(sessionPath, [])
      // Update workspace config with the new session ID
      workspaceConfig.activeSessionId = activeSessionId
      await writeJson(getWorkspaceDataPath(config.workspace), workspaceConfig)
    }

    // Load existing session messages
    let messages = await findSessionFile(activeSessionId, config.workspace)
    if (!messages || !Array.isArray(messages)) {
      messages = []
    }

    // Load configs
    const [_aiConfig, mainConfig] = await Promise.all([
      loadAiConfig(),
      loadMainConfig(),
    ])

    const toolsConfig = mainConfig?.aiTools || {}
    const promptsConfig = mainConfig?.prompts || { files: [] }
    const agentsConfig = mainConfig?.agents || { list: [] }
    const activeAgent = agentsConfig.list?.find(
      (a: any) => a.id === activeAgentId,
    )

    // Ensure system prompt exists
    const updatedMessages: UIMessage[] = [...messages]
    if (
      updatedMessages.length === 0 ||
      !updatedMessages.some((m: any) => m.role === 'system')
    ) {
      // Get merged system prompt
      const { getMergedSystemPrompt } = await import('../ai/prompts')
      const systemPrompt = await getMergedSystemPrompt(
        promptsConfig.files || [],
        activeAgent?.promptFiles || [],
      )
      if (systemPrompt) {
        updatedMessages.unshift({
          id: genId(),
          role: 'system',
          parts: [{ type: 'text', text: systemPrompt }],
        })
      }
    }

    // Add user message
    const userMsg: UIMessage = {
      id: genId(),
      role: 'user',
      parts: [{ type: 'text', text }],
    }
    updatedMessages.push(userMsg)

    await ctx.reply('Processing your request...')

    // Run the agent loop (no approval prompts)
    const activeFile = workspaceConfig.activeFile || ''
    const finalMessages = await runMessengerAgent(
      updatedMessages,
      config.workspace,
      workspaceFolders,
      activeFile,
      toolsConfig,
      (progressText: string) => {
        // Stream command output — send as a status update
        ctx.reply(`\`\`\`\n${progressText}\n\`\`\``).catch(() => {})
      },
    )

    // Save the session — write to today's date directory
    const sessionPath = getSessionPath(
      activeSessionId,
      undefined,
      config.workspace,
    )
    await writeJson(sessionPath, finalMessages)

    // Extract the last assistant text message for the reply
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
      if (textPart) replyText = textPart.text
    }

    await ctx.reply(replyText)
  } catch (err) {
    console.error(`[Messenger] Chat error for "${config.name}":`, err)
    await ctx.reply('An error occurred while processing your request.')
  } finally {
    processing.delete(lockKey)
  }
}

// ─── Bot Lifecycle ──────────────────────────────────────────────────────

export async function reloadMessengers() {
  console.log('[Messenger] reloadMessengers called')
  const configs = await loadConfigs()
  console.log(`[Messenger] ${configs.length} configs, ${bots.size} running`)

  const next = new Map(configs.map((c) => [c.id, c]))

  for (const [id, bot] of bots) {
    const cfg = next.get(id)
    if (!cfg?.enabled) {
      console.log(`[Messenger] stopping ${cfg?.name || id}`)
      bot.stop()
      bots.delete(id)
    }
  }

  for (const c of configs) {
    if (!c.enabled || !c.apiKey || !c.name || !c.workspace) {
      console.log(`[Messenger] ${c.name} skipped`)
      continue
    }
    if (bots.has(c.id)) {
      console.log(`[Messenger] ${c.name} already running`)
      continue
    }
    console.log(`[Messenger] ${c.name} starting...`)
    ;(async () => {
      const { Telegraf } = await import('telegraf')
      const bot = new Telegraf(c.apiKey)
      bot.catch((err) => console.error(`[Messenger] ${c.name} error:`, err))
      bot.start((ctx) => ctx.reply('Connected to Aynite.'))

      bot.on('text', (ctx) => {
        const text = ctx.message.text.trim()
        if (text === '?') {
          handleWorkspaceInfo(c, ctx)
        } else if (text === '/summarize') {
          handleSummarize(c, ctx)
        } else if (text === '/new-session') {
          handleNewSession(c, ctx)
        } else if (text === '/list-sessions') {
          handleListSessions(c, ctx)
        } else if (text.startsWith('/switch-session')) {
          const args = text.slice('/switch-session'.length).trim()
          handleSwitchSession(c, ctx, args)
        } else {
          handleChatMessage(c, ctx, text)
        }
      })

      bots.set(c.id, bot)
      bot
        .launch()
        .catch((err) => console.error(`[Messenger] ${c.name} failed:`, err))
    })()
  }
}
