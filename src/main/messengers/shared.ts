/**
 * Shared messenger logic — provider-agnostic command handlers, agent loop,
 * group message buffering, and lifecycle helpers.
 *
 * Each provider adapter (Telegram, Discord) implements the `MessengerContext`
 * interface and delegates to these shared functions.
 */

import { type ChildProcess, exec, spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { UIMessage } from 'ai'
import { AppEvents } from '../../lib/constants/app'
import type { WorkspaceConfig } from '../../lib/constants/types'
import {
  getAgentPath,
  getAgentsDir,
  getAIConfigPath,
  getBotChatDatePath,
  getBotCommitPath,
  getBotCommitsDir,
  getBotSessionArchivePath,
  getBotSessionMessagesPath,
  getBotSessionMetadataPath,
  getMainConfigPath,
  getMessengersConfigPath,
  getWorkspaceDataPath,
  getWorkspacesConfigPath,
  readJson,
  rename,
  writeJson,
} from '../../lib/path'
import type { MessengerConfig } from '../../lib/types/ai'
import type { SessionMetadata } from '../../lib/types/chat'
import { createMessage } from '../../lib/types/chat'
import {
  createTools,
  getAIModel,
  getProviderReasoningOptions,
  saveSession,
} from '../ai'
import { generateCommitMessage } from '../git/commit-gen'

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

/** Track running dev servers keyed by project folder path */
const devProcesses = new Map<string, ChildProcess>()

/**
 * Kill a dev server process if running.
 * Sends SIGTERM first, then SIGKILL after 3 seconds if it doesn't exit.
 */
async function killDevProcess(root: string): Promise<boolean> {
  const proc = devProcesses.get(root)
  if (!proc) return false

  proc.kill('SIGTERM')

  // Wait up to 3 seconds for graceful exit
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        proc.kill('SIGKILL')
        reject(new Error('Timeout'))
      }, 3000)
      proc.on('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
      proc.on('error', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  } catch {
    // Process was force-killed, that's fine
  }

  devProcesses.delete(root)
  return true
}

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
  /** Optional callback fired when the AI first decides to use a tool in this turn */
  onFirstToolCall?: () => void,
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
  let firstToolCallFired = false

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
      loopMessages.push(createMessage('assistant', parts))
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
        // Fire onFirstToolCall callback on first tool use
        if (!firstToolCallFired) {
          firstToolCallFired = true
          onFirstToolCall?.()
        }
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
  lines.push(
    '`/commit` — Stage all changes, generate commit message, and commit',
  )
  lines.push('`/dev` — Start/restart dev server (`npm run dev`)')
  lines.push('`/clear` — Archive current session and start a new one')
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

// ─── Assistant Default Project Folder ───────────────────────────────────

const ASSISTANT_PROJECT_DIR = join(homedir(), '.aynite', 'assistant')

/**
 * Get or create the default project folder for the assistant agent.
 */
async function ensureAssistantProjectDir(): Promise<string> {
  await mkdir(ASSISTANT_PROJECT_DIR, { recursive: true })
  return ASSISTANT_PROJECT_DIR
}

const execAsync = promisify(exec)

// ─── Command: /commit ───────────────────────────────────────────────────

export async function handleCommit(
  config: MessengerConfig,
  ctx: MessengerContext,
  /** Chat name for per-channel storage, e.g. '@username' (DM) or '#general' (group) */
  chatName?: string,
) {
  const chat = chatName || 'default'

  // ── Resolve project folder ──────────────────────────────────────────
  let root = config.projectFolder
  if (!root) {
    if (config.agentId === 'assistant') {
      root = await ensureAssistantProjectDir()
    } else {
      await ctx.reply(
        'No project folder is set. Use `/set-project` to choose one first.',
      )
      return
    }
  }

  await ctx.reply('Staging all changes...')

  try {
    // ── Stage all ────────────────────────────────────────────────────────
    await execAsync('git add -A', { cwd: root })

    // Check if there's anything to commit
    const { stdout: statusAfter } = await execAsync('git status --porcelain', {
      cwd: root,
    })
    if (!statusAfter.trim()) {
      await ctx.reply('No changes to commit.')
      return
    }

    // ── Generate commit message ──────────────────────────────────────────
    await ctx.reply('Generating commit message...')
    const result = await generateCommitMessage(root)

    if (result.error || !result.message) {
      await ctx.reply(
        `Failed to generate commit message: ${result.error || 'Unknown error'}`,
      )
      return
    }

    const commitMessage = result.message

    // ── Execute commit ──────────────────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      const commitProc = spawn('git', ['commit', '-F', '-'], {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      commitProc.stdin.write(commitMessage)
      commitProc.stdin.end()
      let stderr = ''
      commitProc.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })
      commitProc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(stderr || `git commit exited with code ${code}`))
      })
      commitProc.on('error', reject)
    })

    // ── Get commit hash ─────────────────────────────────────────────────
    const { stdout: commitHash } = await execAsync('git rev-parse HEAD', {
      cwd: root,
    })
    const commitId = commitHash.trim()

    // ── Get changed files list ──────────────────────────────────────────
    const { stdout: changedFiles } = await execAsync(
      'git diff --name-only HEAD~1 HEAD',
      { cwd: root },
    )
    const filesList = changedFiles
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((f) => `- \`${f}\``)
      .join('\n')

    // ── Save to commits directory ────────────────────────────────────────
    const commitsDir = getBotCommitsDir(config.id, chat)
    await mkdir(commitsDir, { recursive: true }).catch(() => {})
    await writeJson(getBotCommitPath(config.id, chat, commitId), {
      commitId,
      commitMessage,
      createdAt: new Date().toISOString(),
      files: changedFiles.trim().split('\n').filter(Boolean),
      validated: false,
    })

    // ── Reply ────────────────────────────────────────────────────────────
    const summary = [
      `✅ *Commit created:* \`${commitId.slice(0, 7)}\``,
      '',
      `*Message:*`,
      escapeMarkdown(commitMessage),
      '',
      `*Files changed:*`,
      filesList || '  (none)',
    ].join('\n')

    await ctx.replyWithMarkdown(summary)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Messenger] /commit error:', errorMsg)
    await ctx.reply(`Commit failed: ${errorMsg}`)
  }
}

// ─── Command: /dev ──────────────────────────────────────────────────────

export async function handleDev(
  config: MessengerConfig,
  ctx: MessengerContext,
) {
  // ── Resolve project folder ──────────────────────────────────────────
  let root = config.projectFolder
  if (!root) {
    if (config.agentId === 'assistant') {
      root = await ensureAssistantProjectDir()
    } else {
      await ctx.reply(
        'No project folder is set. Use `/set-project` to choose one first.',
      )
      return
    }
  }

  try {
    // ── Check if this is Aynite's own project (has electron.vite.config.ts) ──
    const { exists: pathExists } = await import('../../lib/path')
    const isAyniteProject = await pathExists(
      join(root, 'electron.vite.config.ts'),
    ).catch(() => false)

    if (isAyniteProject) {
      // ── For Aynite itself: build latest source then relaunch ───────────
      await ctx.reply('Building latest changes...')

      const { stdout: buildOutput, stderr: buildError } = await execAsync(
        'npm run build',
        { cwd: root },
      )
      console.log(
        `[Messenger] /dev: build output:\n${buildOutput.slice(0, 500)}`,
      )
      if (buildError) {
        console.error(
          `[Messenger] /dev: build stderr:\n${buildError.slice(0, 500)}`,
        )
      }

      await ctx.replyWithMarkdown(
        `✅ *Build complete* — relaunching Aynite with latest changes...\n\nSee you in a moment! 👋`,
      )

      // Relaunch the app with the newly compiled code.
      // In dev mode (electron-vite dev), ELECTRON_RENDERER_URL points to the
      // Vite dev server (e.g. http://localhost:5173/). After building, that
      // server is no longer running, so delete the env var so the new instance
      // loads from the production-built files instead.
      const { app } = await import('electron')
      delete process.env.ELECTRON_RENDERER_URL
      app.relaunch()
      app.exit(0)
      return
    }

    // ── For non-Aynite projects: start/restart npm run dev ────────────
    const existing = devProcesses.get(root)
    if (existing) {
      console.log(`[Messenger] /dev: restarting dev server for ${root}`)
      await ctx.reply('Restarting dev server...')
      await killDevProcess(root)
    } else {
      console.log(`[Messenger] /dev: starting dev server for ${root}`)
      await ctx.reply('Starting dev server...')
    }

    const proc = spawn('npm', ['run', 'dev'], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env },
    })

    let startupOutput = ''
    proc.stdout?.once('data', (chunk: Buffer) => {
      startupOutput += chunk.toString()
    })
    proc.stderr?.once('data', (chunk: Buffer) => {
      startupOutput += chunk.toString()
    })

    proc.on('exit', (code, signal) => {
      console.log(
        `[Messenger] /dev: process for ${root} exited (code=${code}, signal=${signal})`,
      )
      devProcesses.delete(root)
    })

    proc.on('error', (err) => {
      console.error(`[Messenger] /dev: process error for ${root}:`, err)
      devProcesses.delete(root)
    })

    devProcesses.set(root, proc)

    const status = existing ? 'restarted' : 'started'
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const preview = startupOutput
      ? `\n\n\`\`\`\n${startupOutput.slice(0, 500).trim()}\n\`\`\``
      : ''

    await ctx.replyWithMarkdown(
      `✅ *Dev server ${status}* for \`${escapeMarkdown(root)}\`\nPID: \`${proc.pid}\`${preview}\n\nUse \`/dev\` again to restart.`,
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Messenger] /dev error:', errorMsg)
    await ctx.reply(`Failed to start dev server: ${errorMsg}`)
  }
}

// ─── Command: /clear ────────────────────────────────────────────────────

export async function handleClear(
  config: MessengerConfig,
  ctx: MessengerContext,
  /** Chat name for per-channel storage, e.g. '@username' (DM) or '#general' (group) */
  chatName?: string,
) {
  const chat = chatName || 'default'
  const msgPath = getBotSessionMessagesPath(config.id, chat)
  const metaPath = getBotSessionMetadataPath(config.id, chat)
  const timestamp = Date.now()

  try {
    let archived = false

    // Try to archive messages.json
    try {
      const archiveMsgPath = getBotSessionArchivePath(
        config.id,
        chat,
        timestamp,
      )
      await rename(msgPath, archiveMsgPath)
      archived = true
    } catch {
      // messages.json doesn't exist — nothing to archive
    }

    // Try to archive metadata.json
    try {
      const archiveMetaPath = getBotSessionArchivePath(
        config.id,
        chat,
        timestamp,
        'metadata',
      )
      await rename(metaPath, archiveMetaPath)
    } catch {
      // metadata.json doesn't exist — that's fine
    }

    // Reset the in-memory session ID so next message starts fresh
    resetBotSessionId(config.id, chat)

    if (archived) {
      await ctx.replyWithMarkdown(
        `✅ *Session cleared* — previous session archived.\n\nUse \`/commit\` to commit changes, or send a message to start a new session.`,
      )
    } else {
      await ctx.reply('No active session to clear.')
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Messenger] /clear error:', errorMsg)
    await ctx.reply(`Failed to clear session: ${errorMsg}`)
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
    // ── Resolve project folder ──────────────────────────────────────────
    // The assistant agent uses ~/.aynite/assistant/ as default.
    // Other agents must have projectFolder set explicitly.
    let resolvedProjectFolder = config.projectFolder
    if (!resolvedProjectFolder) {
      if (config.agentId === 'assistant') {
        resolvedProjectFolder = await ensureAssistantProjectDir()
        console.log(
          `[Messenger] using default assistant project dir: ${resolvedProjectFolder}`,
        )
      } else {
        await ctx.reply(
          'No project folder is set for this bot. Use `/set-project` to choose one, then try again.',
        )
        return
      }
    }

    // ── Determine chat name ──────────────────────────────────────────────

    const chat = chatName || 'default'

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
    const workspaceFolders = [resolvedProjectFolder]

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
        "Respond conversationally to the user's message. Do NOT use @mentions, @tags, or usernames in your replies — just respond naturally as if talking directly to the person.",
      ].join('\n')
      const systemPrompt = agentPrompt
        ? `${agentPrompt}\n\n${BOT_INSTRUCTION}`
        : BOT_INSTRUCTION
      if (systemPrompt) {
        updatedMessages.unshift(
          createMessage('system', [{ type: 'text', text: systemPrompt }]),
        )
        console.log(
          `[Messenger] added system prompt (${systemPrompt.length} chars)`,
        )
      }
    }

    const now = new Date().toISOString()

    // Inject group context as separate user messages (before the current message)
    // so the AI sees them as distinct conversation turns.
    // Inject limited recent group context as separate messages so the AI
    // has immediate awareness of the last few exchanges. For deeper history,
    // the AI should use the get_messages tool.
    if (groupContextLines && groupContextLines.length > 0) {
      // Only inject the most recent 5 lines to keep session context focused
      const recentLines = groupContextLines.slice(-5)
      for (const line of recentLines) {
        updatedMessages.push(
          createMessage('user', [{ type: 'text', text: line }]),
        )
      }
    }

    const formattedText = `- sender: ${senderLabel || 'Unknown'}
- timestamp: ${now}
- content: ${text}`
    updatedMessages.push(
      createMessage('user', [{ type: 'text', text: formattedText }]),
    )
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
      () => {
        const WORKING_REPLIES = [
          '🤖 The agent is working on your request. This may take a moment...',
          '✨ On it! Let me work some magic behind the scenes — hang tight!',
          "⏳ Processing your request. I'll be right back with the results.",
          "🔧 Give me a sec — I'm busy tinkering under the hood! Back soon!",
          '🤖 Agent loop engaged. Running tools & waiting for outputs. Stand by...',
          '🤖 Working...',
          "💪 Working on it! Just give me a moment and I'll have an answer for you.",
          '🎬 The agent is now entering the arena. Spectacular things are happening. Please wait...',
          '🚀 Processing your request... accessing tools, running commands, gathering results! Be right back!',
          "🤖 The gears are turning (sometimes literally). I'll be back with your answer shortly!",
        ]
        const msg =
          WORKING_REPLIES[Math.floor(Math.random() * WORKING_REPLIES.length)]
        ctx.reply(msg).catch(() => {})
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

// ─── Normalized Incoming Message ─────────────────────────────────────────

/**
 * A normalized message from any messaging platform.
 * Each adapter (Telegram, Discord, etc.) creates one of these and passes it
 * to processIncomingMessage(), which handles all routing logic uniformly.
 */
export interface IncomingMessage {
  /** Raw message text (before any mention stripping) */
  rawText: string
  /** Whether this is a private/DM chat */
  isPrivate: boolean
  /** Unique name for the channel (e.g. '@username', '#Server/general') */
  chatName: string
  /** Platform-specific chat ID (used for group buffer key) */
  chatId: string | number
  /** Display label for the sender (e.g. '@john', 'John Doe') */
  senderLabel: string
  /** Message text with bot mention stripped (for command matching) */
  textWithoutMention: string
  /** Whether the bot was mentioned/mentioned in a group chat */
  isMentioned: boolean
  /** Raw sender ID string (for whitelist matching) */
  senderRaw: string
  /** Sender's @username (for whitelist matching, without @) */
  senderUsername: string
  /** Additional whitelist identifiers (e.g. Discord globalName) */
  senderExtra?: string
}

/**
 * Process an incoming message from any messenger.
 * Handles persistence, buffering, mention check, whitelist, busy check,
 * command routing, and AI chat — all in a provider-agnostic way.
 */
export async function processIncomingMessage(
  config: MessengerConfig,
  ctx: MessengerContext,
  msg: IncomingMessage,
) {
  console.log(
    `[Messenger] processIncomingMessage: provider="${config.provider}" chatType="${msg.isPrivate ? 'dm' : 'group'}" from="${msg.senderLabel}" text="${msg.rawText.slice(0, 100)}"`,
  )

  // ── 1. Persist every message to chat history ───────────────────────────
  saveBotMessage(
    config.id,
    msg.chatName,
    'user',
    msg.senderLabel,
    msg.rawText,
  ).catch(() => {})

  // ── 2. Buffer the message (for in-memory group context) ────────────────
  const contextSize = config.contextSize || 100
  pushToGroupBuffer(
    config.id,
    msg.chatId,
    `${msg.senderLabel}: ${msg.rawText}`,
    contextSize,
  )

  // ── 3. Group message: only respond if mentioned ────────────────────────
  if (!msg.isPrivate && !msg.isMentioned) {
    console.log(
      `[Messenger] ignoring non-mentioned group message from ${msg.senderLabel}`,
    )
    return
  }

  // ── 4. Whitelist access control ────────────────────────────────────────
  if (!config.whitelist || config.whitelist.length === 0) {
    await ctx.reply("Sorry, I'm not allowed to talk to you.")
    return
  }
  const isAllowed = config.whitelist.some((entry) => {
    const norm = entry.trim().toLowerCase()
    return (
      norm === msg.senderRaw.toLowerCase() ||
      norm === `@${msg.senderUsername.toLowerCase()}` ||
      norm === msg.senderUsername.toLowerCase() ||
      (msg.senderExtra ? norm === msg.senderExtra.toLowerCase() : false)
    )
  })
  if (!isAllowed) {
    await ctx.reply("Sorry, I'm not allowed to talk to you.")
    return
  }

  // ── 5. Busy check ─────────────────────────────────────────────────────
  const busyReply = await getBusyReply(config.id, msg.chatName)
  if (busyReply) {
    await ctx.reply(busyReply)
    return
  }

  // ── 6. Build group context lines (only the most recent) ────────────────
  let groupContextLines: string[] | undefined
  if (!msg.isPrivate) {
    const context = getGroupContext(config.id, msg.chatId)
    if (context) {
      groupContextLines = context.split('\n').filter(Boolean)
    }
  }

  // ── 7. Command routing (using text without mention) ────────────────────
  const lowerCmd = msg.textWithoutMention.toLowerCase()

  if (
    lowerCmd === '/?' ||
    lowerCmd === '/h' ||
    lowerCmd === '/help' ||
    lowerCmd === '?'
  ) {
    await handleHelp(config, ctx)
  } else if (lowerCmd.startsWith('/set-project')) {
    const args = msg.textWithoutMention.slice('/set-project'.length).trim()
    await handleSetProject(config, ctx, args)
  } else if (lowerCmd.startsWith('/set-agent')) {
    const args = msg.textWithoutMention.slice('/set-agent'.length).trim()
    await handleSetAgent(config, ctx, args)
  } else if (lowerCmd === '/commit') {
    await handleCommit(config, ctx, msg.chatName)
  } else if (lowerCmd === '/dev') {
    await handleDev(config, ctx)
  } else if (lowerCmd === '/clear') {
    await handleClear(config, ctx, msg.chatName)
  } else {
    await handleChatMessage(
      config,
      ctx,
      msg.textWithoutMention,
      msg.chatName,
      msg.senderLabel,
      groupContextLines,
    )
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
 * Describe a tool part as a single sentence indicating the agent's progress.
 * Mirrors the style used in the session message list titles.
 */
function describeToolAction(part: any): string {
  const toolName = part.toolName || ''
  const input = part.input ?? part.args ?? {}
  const actualArgs = input?.args || input?.input || input

  const getDetail = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null
    return obj.command || obj.path || obj.pattern || obj.url || obj.name || null
  }

  switch (toolName) {
    case 'run_command': {
      let cmd = getDetail(actualArgs) || ''
      cmd = cmd.replace(/^cd\s+\S+(\s*[;&|]{1,2}\s*)?/, '').trim()
      return `running a command: ${cmd || '...'}`
    }
    case 'read_file':
      return `reading: ${getDetail(actualArgs) || '...'}`
    case 'write_file':
    case 'edit_file':
      return `writing to: ${getDetail(actualArgs) || '...'}`
    case 'grep_search':
      return `searching for: ${getDetail(actualArgs) || '...'}`
    case 'glob_search':
      return `searching for files matching: ${getDetail(actualArgs) || '...'}`
    case 'read_url':
      return `fetching: ${getDetail(actualArgs) || '...'}`
    case 'get_messages':
      return 'reading chat history'
    case 'notify_user':
      return 'processing your request'
    case 'memory-manager':
    case 'task-manager':
      return 'organizing tasks and memory'
    default: {
      const formatted = toolName.toUpperCase().replace(/_/g, ' ')
      const detail = getDetail(actualArgs)
      return detail ? `using ${formatted}: ${detail}` : `using ${formatted}`
    }
  }
}

/**
 * Check if a bot is busy processing a message for a specific chat.
 * If busy, returns a reply string with a single sentence describing
 * what the agent is doing. Returns null if not busy.
 */
export async function getBusyReply(
  messengerId: string,
  chatName: string,
): Promise<string | null> {
  const lockKey = getBotLockKey(messengerId, chatName)
  if (!processing.has(lockKey)) return null

  try {
    const msgs = await loadBotSessionMessages(messengerId, chatName)
    if (msgs && Array.isArray(msgs)) {
      const lastAssistant = [...msgs]
        .reverse()
        .find((m: any) => m.role === 'assistant' && m.parts?.length > 0)

      if (lastAssistant) {
        // Look for a tool part first (dynamic-tool, tool-call, tool-result)
        for (const part of lastAssistant.parts) {
          if (
            part.type === 'dynamic-tool' ||
            part.type === 'tool-call' ||
            part.type === 'tool-result'
          ) {
            const action = describeToolAction(part)
            return `The agent is working on your request. It is ${action}.`
          }
        }

        // No tool part — check if there's text content
        const textPart = lastAssistant.parts.find(
          (p: any) => p.type === 'text' && p.text,
        )
        if (textPart) {
          return 'The agent is working on your request. It is analyzing your question.'
        }
      }
    }
  } catch {
    // Best effort — fall through to generic reply
  }

  return 'The agent is working on your request. Please wait.'
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

/**
 * Update the bot's connection status in the config file.
 * Called by each adapter after successful launch or failure.
 * Optionally accepts an error message to store when disconnected.
 */
export async function updateBotConnectionStatus(
  configId: string,
  connected: boolean,
  error?: string,
) {
  const configs = await loadConfigs()
  const idx = configs.findIndex((c) => c.id === configId)
  if (idx === -1) return
  const current = configs[idx]
  // Skip if nothing changed
  if (current.connected === connected && !error) return
  const update: Partial<MessengerConfig> = { connected }
  if (connected) {
    update.lastError = undefined // Clear error on success
  } else if (error) {
    update.lastError = error
  }
  configs[idx] = { ...current, ...update }
  await saveConfigsDirect(configs)
  const { broadcastAppEvent } = await import('../ipc-utils')
  broadcastAppEvent(AppEvents.CONFIG_CHANGED, { key: 'messengers' })
  console.log(
    `[Messenger] connection status for ${configId}: ${connected ? 'connected' : 'disconnected'}${error ? ` error=${error}` : ''}`,
  )
}

/**
 * Update the bot's name in the config if it's not set or has changed.
 * Called by each adapter after a successful connection.
 */
export async function updateBotName(configId: string, botName: string) {
  console.log(
    `[Messenger] updateBotName called: configId=${configId} botName="${botName}"`,
  )
  const configs = await loadConfigs()
  console.log(
    `[Messenger] updateBotName: loaded ${configs.length} configs`,
    configs.map((c) => ({ id: c.id, botName: c.botName })),
  )
  const idx = configs.findIndex((c) => c.id === configId)
  if (idx === -1) {
    console.log(
      `[Messenger] updateBotName: configId ${configId} NOT FOUND in configs`,
    )
    return
  }

  const current = configs[idx]
  console.log(
    `[Messenger] updateBotName: current.botName="${current.botName}" new.botName="${botName}"`,
  )
  if (current.botName === botName) {
    console.log(
      `[Messenger] updateBotName: botName already set to "${botName}", skipping`,
    )
    return // Already correct — no update needed
  }

  configs[idx] = { ...current, botName }
  console.log(
    `[Messenger] updateBotName: saving configsDirect, configs[idx] now=`,
    { id: configs[idx].id, botName: configs[idx].botName },
  )
  await saveConfigsDirect(configs)
  const { broadcastAppEvent } = await import('../ipc-utils')
  broadcastAppEvent(AppEvents.CONFIG_CHANGED, { key: 'messengers' })
  console.log(`[Messenger] bot name updated: ${botName}`)
}
