/**
 * Messenger Runtime — manages Telegram bot polling across configured messengers.
 *
 * Each bot reads its own config (workspace binding) and handles commands:
 * - "?" → replies with workspace information (name, folders, active session details, available commands)
 * - "/summarize" → summarizes the active session and updates metadata title/description
 * - any other text → sends the message to the AI agent loop and replies with the result
 */

import type { UIMessage } from 'ai'
import { AppEvents } from '../../lib/constants/app'
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
import {
  createTools,
  getAIModel,
  getProviderReasoningOptions,
  saveSession,
} from '../ai'
import { broadcastAppEvent } from '../window'
import { saveWorkspaceState } from '../workspace'

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

// Pool of randomised "processing" replies — picked at random each time
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

  // Separate system message
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

  // Create tools with command progress callback and auto-approve for messenger
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
    // Allow up to 100 steps (tool call rounds) — prevents infinite loops
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
        // Incremental save: flush accumulated assistant message and persist to disk
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

    const { activeSessionId, activeSessionIdForBot, activeAgentId, folders } =
      workspaceConfig

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

    const botSessionId = activeSessionIdForBot || activeSessionId
    if (botSessionId) {
      lines.push('')
      lines.push(`*Bot Session:* \`${botSessionId}\``)

      const { metadata: foundMetadata } = await findMetadata(
        botSessionId,
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
            botSessionId,
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
        lines.push(`*Session:* \`${botSessionId}\` _(no metadata)_`)
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

    const botSessionId =
      workspaceConfig.activeSessionIdForBot || workspaceConfig.activeSessionId
    if (!botSessionId) {
      await ctx.reply('No active session.')
      return
    }

    const messages = await findSessionFile(botSessionId, config.workspace)
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      await ctx.reply('Active session is empty.')
      return
    }

    await ctx.reply('Summarizing session...')

    const chatMessages = messages.filter((m: any) => m.role !== 'system')
    // Ask for a meaningful title and then the summary body
    const summaryPrompt =
      'Start with a concise, meaningful title (max 10 words, no markdown, no "Summary of" prefix) on the first line. Then provide a detailed summary of the conversation below, preserving all key information, decisions, and context.'

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

    // First line is the title, the rest is the summary body
    const lines = summaryText.split('\n')
    const firstLine = lines[0]?.trim() || ''
    const title =
      firstLine.replace(/^#+\s*/, '').slice(0, 100) || 'Conversation'
    const body = lines.slice(1).join('\n').trim() || summaryText

    // Write metadata to today's date directory (consistent with saveSession)
    const metaPath = getSessionMetadataPath(
      botSessionId,
      undefined,
      config.workspace,
    )
    const existingMeta = await readJson<SessionMetadata>(metaPath).catch(
      () => null,
    )
    await writeJson(metaPath, {
      ...(existingMeta || {}),
      title,
      description: body,
      updatedAt: new Date().toISOString(),
    })

    await ctx.replyWithMarkdown(
      `*Session summarized*\n\n*Title:* ${escapeMarkdown(title)}\n*Description:* ${escapeMarkdown(body.slice(0, 200))}...`,
    )
  } catch (err) {
    console.error(`[Messenger] Summarize error for "${config.name}":`, err)
    await ctx.reply('Failed to summarize session.')
  }
}

async function handleNewSession(config: MessengerConfig, ctx: any) {
  try {
    const newId = Date.now().toString()
    // Use saveSession (consistent with ChatService) — no metadata for empty session
    await saveSession(config.workspace, newId, [], undefined)
    // Use saveWorkspaceState for atomic field update — avoids stale read race conditions
    await saveWorkspaceState(config.workspace, {
      activeSessionIdForBot: newId,
    })
    broadcastAppEvent(AppEvents.CONFIG_CHANGED, {
      key: 'activeSessionIdForBot',
    })

    await ctx.replyWithMarkdown(`*New bot session created*\n\nID: \`${newId}\``)
  } catch (err) {
    console.error(`[Messenger] New session error for "${config.name}":`, err)
    await ctx.reply('Failed to create new session.')
  }
}

async function handleListSessions(config: MessengerConfig, ctx: any) {
  try {
    const { listSessions } = await import('../ai')
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

    const { listSessions } = await import('../ai')
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

    // Use saveWorkspaceState for atomic field update — avoids stale read race conditions
    await saveWorkspaceState(config.workspace, {
      activeSessionIdForBot: target.id,
    })
    broadcastAppEvent(AppEvents.CONFIG_CHANGED, {
      key: 'activeSessionIdForBot',
    })

    const title = target.title || `Session ${target.id.slice(-6)}`
    await ctx.replyWithMarkdown(
      `*Switched bot to session*\n\n*Title:* ${escapeMarkdown(title)}\n*ID:* \`${target.id}\``,
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

  // If the agent is already processing a message for this bot, reply with a
  // single merged message explaining the situation and showing the last reply.
  if (processing.has(lockKey)) {
    let lastReply = ''
    try {
      const wsConfig = await readJson<WorkspaceConfig>(
        getWorkspaceDataPath(config.workspace),
      )
      const botId = wsConfig.activeSessionIdForBot || wsConfig.activeSessionId
      if (botId) {
        const msgs = await findSessionFile(botId, config.workspace)
        if (msgs && Array.isArray(msgs)) {
          const lastText = [...msgs]
            .reverse()
            .find(
              (m: any) =>
                m.role === 'assistant' &&
                m.parts?.some((p: any) => p.type === 'text'),
            )
          if (lastText) {
            const textPart = lastText.parts.find((p: any) => p.type === 'text')
            if (textPart?.text) {
              lastReply = textPart.text.slice(0, 2000)
            }
          }
        }
      }
    } catch {
      // Best effort
    }

    const message = lastReply
      ? `The agent is busy with the last request.\n\nHere is the latest message from the session:\n\n${escapeMarkdown(lastReply)}`
      : 'The agent is currently processing a request. Please wait before sending another message.'

    await ctx.reply(message)
    return
  }

  processing.add(lockKey)

  try {
    console.log(
      `[Messenger] handleChatMessage: bot="${config.name}" session="${config.workspace}" text="${text.slice(0, 100)}"`,
    )

    const workspaceConfig = await readJson<WorkspaceConfig>(
      getWorkspaceDataPath(config.workspace),
    )
    if (!workspaceConfig) {
      await ctx.reply(`Workspace "${config.workspace}" not found.`)
      return
    }

    const {
      activeSessionId,
      activeSessionIdForBot,
      activeAgentId,
      folders: workspaceFolders,
    } = workspaceConfig
    const botSessionId = activeSessionIdForBot || activeSessionId
    console.log(
      `[Messenger] workspace: activeSessionId="${activeSessionId}" activeSessionIdForBot="${activeSessionIdForBot}" botSessionId="${botSessionId}" activeAgentId="${activeAgentId}" folders=${workspaceFolders?.length}`,
    )

    let sessionId: string
    if (!botSessionId) {
      // Create a new session using saveSession (consistent with ChatService)
      sessionId = Date.now().toString()
      await saveSession(config.workspace, sessionId, [], undefined)
      // Use saveWorkspaceState for atomic field update — avoids stale read race conditions
      await saveWorkspaceState(config.workspace, {
        activeSessionIdForBot: sessionId,
      })
      broadcastAppEvent(AppEvents.CONFIG_CHANGED, {
        key: 'activeSessionIdForBot',
      })
      console.log(`[Messenger] created new bot session: ${sessionId}`)
    } else {
      sessionId = botSessionId
    }

    // Load existing session messages
    let messages = await findSessionFile(sessionId, config.workspace)
    if (!messages || !Array.isArray(messages)) {
      messages = []
    }
    console.log(`[Messenger] loaded ${messages.length} existing messages`)

    // Load configs
    const [aiConfig, mainConfig] = await Promise.all([
      loadAiConfig(),
      loadMainConfig(),
    ])

    const toolsConfig = mainConfig?.aiTools || {}
    const promptsConfig = mainConfig?.prompts || { files: [] }
    const agentsConfig = mainConfig?.agents || { list: [] }
    const activeAgent = agentsConfig.list?.find(
      (a: any) => a.id === activeAgentId,
    )

    // Extract provider info for metadata (consistent with ChatService)
    const activeProvider =
      aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
      aiConfig?.providers?.[0]

    // Ensure system prompt exists
    const updatedMessages: UIMessage[] = [...messages]
    if (
      updatedMessages.length === 0 ||
      !updatedMessages.some((m: any) => m.role === 'system')
    ) {
      // Get merged system prompt
      const { getMergedSystemPrompt } = await import('../ai')
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
        console.log(
          `[Messenger] added system prompt (${systemPrompt.length} chars)`,
        )
      }
    }

    // Add user message
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

    // Run the agent loop (no approval prompts, no intermediate streaming)
    const activeFile = workspaceConfig.activeFile || ''
    const finalMessages = await runMessengerAgent(
      updatedMessages,
      config.workspace,
      workspaceFolders,
      activeFile,
      toolsConfig,
      () => {}, // No-op progress — we only reply when the full loop finishes
      sessionId,
    )

    console.log(
      `[Messenger] agent loop finished, total messages: ${finalMessages.length}`,
    )

    // Build metadata consistent with ChatService's scheduleSave()
    const agentName = activeAgent?.name || 'Chat'
    const modelName = activeProvider?.name || activeProvider?.model || 'AI'
    const metadata: SessionMetadata = {
      agentName,
      modelName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Save the session with metadata (consistent with ChatService via saveSession)
    await saveSession(config.workspace, sessionId, finalMessages, metadata)
    console.log(`[Messenger] session saved (with metadata): ${sessionId}`)

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
      if (textPart) replyText = (textPart as any).text
    }

    console.log(`[Messenger] replying with ${replyText.length} chars`)
    await ctx.reply(replyText)
  } catch (err) {
    console.error(`[Messenger] Chat error for "${config.name}":`, err)
    await ctx.reply('An error occurred while processing your request.')
  } finally {
    processing.delete(lockKey)
    console.log(`[Messenger] processing lock released for "${config.name}"`)
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
