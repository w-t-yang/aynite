/**
 * Telegram messenger adapter using Telegraf.
 *
 * Creates a Telegraf bot instance and wires it to the shared command handlers.
 * Provides a `MessengerContext` implementation wrapping Telegraf's `ctx`.
 */

import { AppEvents } from '../../lib/constants/app'
import type { MessengerConfig } from '../../lib/types/ai'
import { broadcastAppEvent } from '../ipc-utils'
import type { BotHandle } from './shared'
import {
  getBusyReply,
  getGroupContext,
  getSenderLabel,
  handleChatMessage,
  handleHelp,
  handleSetAgent,
  handleSetProject,
  loadConfigs,
  pushToGroupBuffer,
  saveBotMessage,
  saveConfigsDirect,
  setBot,
} from './shared'

/** Bot handle wrapping a Telegraf instance */
class TelegramBotHandle implements BotHandle {
  constructor(private bot: import('telegraf').Telegraf) {}

  stop() {
    this.bot.stop()
  }
}

export async function startTelegramBot(config: MessengerConfig) {
  const { Telegraf } = await import('telegraf')
  const bot = new Telegraf(config.apiKey)
  bot.catch((err) =>
    console.error(`[Messenger] ${config.provider} error:`, err),
  )
  bot.start((ctx) => ctx.reply('Connected to Aynite.'))

  bot.on('text', async (ctx) => {
    console.log(
      `[Messenger] text received: chatType="${ctx.chat?.type}" from="${ctx.from?.id}" text="${(ctx.message.text || '').slice(0, 100)}"`,
    )

    // Reload the latest config for this bot on every message so that
    // whitelist changes take effect immediately.
    let botConfig = config
    try {
      const configs = await loadConfigs()
      const fresh = configs.find((cfg) => cfg.id === config.id)
      if (fresh) botConfig = fresh
    } catch {
      // Fall back to closure config
    }

    const messengerCtx = {
      reply: (text: string): Promise<void> => ctx.reply(text).then(() => {}),
      replyWithMarkdown: (text: string): Promise<void> =>
        ctx.replyWithMarkdown(text).then(() => {}),
    }

    const isPrivate = ctx.chat?.type === 'private'
    const chatId = ctx.chat?.id

    // Determine chat name as early as possible so we can persist every message
    const chatName = isPrivate
      ? ctx.from?.username
        ? `@${ctx.from.username}`
        : `user-${ctx.from?.id}`
      : `#${(ctx.chat as any)?.title || chatId}`

    // Persist ALL messages to chat history (even non-mentioned group messages)
    // so the agent can later read context via get_messages tool.
    const senderLabel = getSenderLabel(ctx.from)
    const msgText = ctx.message.text || ''
    saveBotMessage(config.id, chatName, 'user', senderLabel, msgText).catch(
      () => {},
    )

    // Buffer and check mention for group messages
    if (!isPrivate) {
      const contextSize = botConfig.contextSize || 100
      pushToGroupBuffer(
        config.id,
        chatId,
        `${senderLabel}: ${msgText}`,
        contextSize,
      )

      const botUsername = ctx.botInfo?.username
      if (botUsername) {
        const lowerText = msgText.toLowerCase()
        const tagTarget = `@${botUsername.toLowerCase()}`
        const entities = ctx.message.entities || []
        const entityMentionsBot = entities.some(
          (e: any) =>
            e.type === 'mention' &&
            lowerText.slice(e.offset, e.offset + e.length) === tagTarget,
        )
        const textMentionsBot = lowerText.includes(tagTarget)
        if (!entityMentionsBot && !textMentionsBot) {
          console.log(
            `[Messenger] ignoring non-mentioned group message from ${senderLabel}`,
          )
          return
        }
      }
    }

    // Buffer private messages too
    if (isPrivate && chatId) {
      const contextSize = botConfig.contextSize || 100
      pushToGroupBuffer(
        config.id,
        chatId,
        `${senderLabel}: ${msgText}`,
        contextSize,
      )
    }

    // Access control: whitelist check
    if (!botConfig.whitelist || botConfig.whitelist.length === 0) {
      ctx.reply("Sorry, I'm not allowed to talk to you.")
      return
    }
    const senderId = String(ctx.from?.id ?? '')
    const senderUsername = ctx.from?.username
      ? `@${ctx.from.username.toLowerCase()}`
      : ''
    console.log(
      `[Messenger] whitelist check: senderId="${senderId}" senderUsername="${senderUsername}" whitelist=[${(botConfig.whitelist || []).join(',')}]`,
    )
    const isAllowed = botConfig.whitelist.some((entry) => {
      const normalized = entry.trim().toLowerCase()
      return (
        normalized === senderId ||
        normalized === senderUsername ||
        normalized === senderUsername.replace('@', '')
      )
    })
    if (!isAllowed) {
      ctx.reply("Sorry, I'm not allowed to talk to you.")
      return
    }

    // Strip @botname mention from the text before command matching
    const botUsername = ctx.botInfo?.username
    const cleanText = ctx.message.text.trim()
    const cleanTextForCheck = botUsername
      ? cleanText.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim()
      : cleanText
    const cleanLower = cleanTextForCheck.toLowerCase()

    // ── Busy check: if this chat is already processing, reject all messages ──

    const busyReply = await getBusyReply(config.id, chatName)
    if (busyReply) {
      await ctx.reply(busyReply)
      return
    }

    // Build group context lines as separate messages (if applicable)
    let groupContextLines: string[] | undefined
    if (!isPrivate && chatId) {
      const context = getGroupContext(config.id, chatId)
      if (context) {
        groupContextLines = context.split('\n').filter(Boolean)
      }
    }

    if (
      cleanLower === '/?' ||
      cleanLower === '/h' ||
      cleanLower === '/help' ||
      cleanLower === '?' ||
      cleanLower === '/help'
    ) {
      handleHelp(botConfig, messengerCtx)
    } else if (cleanLower.startsWith('/set-project')) {
      const args = cleanTextForCheck.slice('/set-project'.length).trim()
      handleSetProject(botConfig, messengerCtx, args)
    } else if (cleanLower.startsWith('/set-agent')) {
      const args = cleanTextForCheck.slice('/set-agent'.length).trim()
      handleSetAgent(botConfig, messengerCtx, args)
    } else {
      const senderLabel = getSenderLabel(ctx.from)
      handleChatMessage(
        botConfig,
        messengerCtx,
        cleanTextForCheck,
        chatName,
        senderLabel,
        groupContextLines,
      )
    }
  })

  setBot(config.id, new TelegramBotHandle(bot))

  // Capture bot name using the onLaunch callback — Telegraf calls it right
  // after getMe() resolves (before polling starts, which never resolves).
  bot
    .launch(() => {
      const username = bot.botInfo?.username
      if (username) {
        loadConfigs()
          .then((configs) => {
            const updated = configs.map((c) =>
              c.id === config.id ? { ...c, botName: `@${username}` } : c,
            )
            return saveConfigsDirect(updated)
          })
          .then(() => {
            broadcastAppEvent(AppEvents.CONFIG_CHANGED, { key: 'messengers' })
            console.log(`[Messenger] Telegram bot name saved: @${username}`)
          })
          .catch(() => {})
      }
    })
    .catch((err) =>
      console.error(`[Messenger] ${config.provider} failed:`, err),
    )
}
