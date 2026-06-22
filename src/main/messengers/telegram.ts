/**
 * Telegram messenger adapter using Telegraf.
 *
 * Thin adapter — translates Telegram's API into the normalized
 * IncomingMessage interface and delegates to processIncomingMessage().
 */

import type { MessengerConfig } from '../../lib/types/ai'
import type { BotHandle, IncomingMessage } from './shared'
import {
  createMessengerContext,
  loadConfigs,
  processIncomingMessage,
  setBot,
  updateBotConnectionStatus,
  updateBotName,
} from './shared'

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
    // Reload config for every message (live whitelist/agent changes)
    let botConfig = config
    try {
      const configs = await loadConfigs()
      const fresh = configs.find((c) => c.id === config.id)
      if (fresh) botConfig = fresh
    } catch {
      /* use closure config */
    }

    const rawText = ctx.message.text || ''
    const isPrivate = ctx.chat?.type === 'private'
    const chatId = ctx.chat?.id ?? 0

    // Sender info
    const senderLabel = ctx.from?.username
      ? `@${ctx.from.username}`
      : [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') ||
        `User ${ctx.from?.id}`
    const senderRaw = String(ctx.from?.id ?? '')
    const senderUsername = ctx.from?.username || ''

    // Chat name (unique identifier for this channel)
    const chatName = isPrivate
      ? ctx.from?.username
        ? `@${ctx.from.username}`
        : `user-${ctx.from?.id}`
      : `#${(ctx.chat as any)?.title || chatId}`

    // Mention detection (Telegram: @username via entities or text match)
    let isMentioned = isPrivate
    if (!isPrivate && ctx.botInfo?.username) {
      const tag = `@${ctx.botInfo.username.toLowerCase()}`
      const entities = ctx.message.entities || []
      const entityMatch = entities.some(
        (e: any) =>
          e.type === 'mention' &&
          rawText.toLowerCase().slice(e.offset, e.offset + e.length) === tag,
      )
      isMentioned = entityMatch || rawText.toLowerCase().includes(tag)
    }

    // Strip @mention for command matching
    const textWithoutMention = ctx.botInfo?.username
      ? rawText.replace(new RegExp(`@${ctx.botInfo.username}`, 'gi'), '').trim()
      : rawText.trim()

    // Build MessengerContext with auto-truncation
    const messengerCtx = createMessengerContext(
      (text: string) => ctx.reply(text).then(() => {}),
      (text: string) => ctx.replyWithMarkdown(text).then(() => {}),
    )

    // Normalized message
    const msg: IncomingMessage = {
      rawText,
      isPrivate,
      chatName,
      chatId,
      senderLabel,
      textWithoutMention,
      isMentioned,
      senderRaw,
      senderUsername,
    }

    await processIncomingMessage(botConfig, messengerCtx, msg)
  })

  setBot(config.id, new TelegramBotHandle(bot))

  // Capture bot name via onLaunch callback
  bot
    .launch(() => {
      const username = bot.botInfo?.username
      console.log(
        `[Messenger] Telegram bot launched: config.id=${config.id} username=${username}`,
      )
      updateBotConnectionStatus(config.id, true).catch(() => {})
      if (username) {
        updateBotName(config.id, `@${username}`)
      } else {
        console.log(
          `[Messenger] Telegram bot launched but no username in botInfo:`,
          bot.botInfo,
        )
      }
    })
    .catch((err) => {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[Messenger] ${config.provider} failed:`, errorMsg)
      updateBotConnectionStatus(config.id, false, errorMsg).catch(() => {})
    })
}
