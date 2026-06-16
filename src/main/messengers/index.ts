/**
 * Messenger Runtime — manages Telegram bot polling across configured messengers.
 *
 * Each bot reads its own config (workspace binding) and handles commands:
 * - "?" → replies with workspace information (name, folders, active session details, available commands)
 * - "/summarize" → summarizes the active session and updates metadata title/description
 * - other text → replies with "WIP" (placeholder for future AI integration)
 */

import type { WorkspaceConfig } from '../../lib/constants/types'
import {
  getAIConfigPath,
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
import { getAIModel } from '../ai/factory'

const bots = new Map<string, import('telegraf').Telegraf>()

function loadConfigs(): Promise<MessengerConfig[]> {
  return readJson<MessengerConfig[]>(getMessengersConfigPath(), [])
}

function loadAiConfig() {
  return readJson<any>(getAIConfigPath())
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Escape Telegram MarkdownV2 reserved characters in a string.
 * This ensures dynamic text (titles, descriptions, file paths) doesn't
 * break Telegram's markdown parser.
 */
function escapeMarkdown(text: string): string {
  // Escape characters that break Telegram Markdown (legacy mode):
  // _ (italic), * (bold), ` (code), [ (link text)
  return text.replace(/[_*`[]/g, '\\$&')
}

// ─── Helpers ─────────────────────────────────────────────────────────────

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
      for (const f of folders) {
        lines.push(`  ${escapeMarkdown(f)}`)
      }
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

    // Available commands
    lines.push('')
    lines.push('---')
    lines.push('*Commands:*')
    lines.push('`?` — Show workspace info')
    lines.push('`/summarize` — Summarize active session')

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

    // Load the session messages
    const messages = await findSessionFile(activeSessionId, config.workspace)
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      await ctx.reply('Active session is empty.')
      return
    }

    await ctx.reply('Summarizing session...')

    // Build summary prompt — exclude system messages, keep user + assistant
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

    // Load AI config
    const aiConfig = await loadAiConfig()
    const activeProvider =
      aiConfig?.providers?.find((p: any) => p.id === aiConfig.activeId) ||
      aiConfig?.providers?.[0]

    if (!activeProvider) {
      await ctx.reply('No active AI provider configured.')
      return
    }

    // Call AI for summarization using streamText directly
    const { streamText, convertToModelMessages } = await import('ai')
    const model = getAIModel(activeProvider)
    const modelMessages = await convertToModelMessages(summaryMessages, {
      tools: {},
      ignoreIncompleteToolCalls: true,
    })

    let summaryText = ''
    const result = streamText({
      model,
      messages: modelMessages,
      tools: {},
    })

    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        summaryText += part.text
      }
      if (part.type === 'error') {
        await ctx.reply(`Summarization failed: ${part.error}`)
        return
      }
    }

    // Generate title from first meaningful line of the summary
    const lines = summaryText.split('\n').filter((l: string) => l.trim())
    const firstLine = lines[0]?.trim() || ''
    // Remove markdown-style heading markers for cleaner title
    const title =
      firstLine.replace(/^#+\s*/, '').slice(0, 100) || 'Conversation Summary'
    // Store full summary as description
    const description = summaryText

    // Update the metadata
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
        description,
        updatedAt: new Date().toISOString(),
      })
    }

    await ctx.replyWithMarkdown(
      `*Session summarized*\n\n*Title:* ${escapeMarkdown(title)}\n*Description:* ${escapeMarkdown(description)}`,
    )
  } catch (err) {
    console.error(`[Messenger] Summarize error for "${config.name}":`, err)
    await ctx.reply('Failed to summarize session.')
  }
}

// ─── Bot Lifecycle ──────────────────────────────────────────────────────

export async function reloadMessengers() {
  console.log('[Messenger] reloadMessengers called')
  const configs = await loadConfigs()
  console.log(`[Messenger] ${configs.length} configs, ${bots.size} running`)

  const next = new Map(configs.map((c) => [c.id, c]))

  // Stop removed or disabled bots
  for (const [id, bot] of bots) {
    const cfg = next.get(id)
    if (!cfg?.enabled) {
      console.log(`[Messenger] stopping ${cfg?.name || id}`)
      bot.stop()
      bots.delete(id)
    }
  }

  // Start new bots
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

      // Handle text messages
      bot.on('text', (ctx) => {
        const text = ctx.message.text.trim()
        if (text === '?') {
          handleWorkspaceInfo(c, ctx)
        } else if (text === '/summarize') {
          handleSummarize(c, ctx)
        } else {
          ctx.reply('WIP')
        }
      })

      bots.set(c.id, bot)
      bot
        .launch()
        .catch((err) => console.error(`[Messenger] ${c.name} failed:`, err))
    })()
  }
}
