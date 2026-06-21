/**
 * Discord messenger adapter using discord.js.
 *
 * Creates a discord.js Client and wires it to the shared command handlers.
 * Discord uses snowflake IDs for user identification. The `apiKey` field
 * in MessengerConfig holds the Discord bot token.
 *
 * Required Discord Developer Portal settings:
 * - Bot → Privileged Gateway Intents → **Message Content Intent** (must be ON)
 *
 * For the bot to receive DMs, you MUST share at least one mutual server
 * (guild) with the bot. Discord does not allow DMs from users who don't
 * share a server with the bot.
 *
 * `Partials.Channel` is required in the client options — without it, DM
 * channels received for the first time are treated as partial/uncached and
 * the message event is silently dropped by discord.js.
 */

import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import type { MessengerConfig } from '../../lib/types/ai'
import type { BotHandle } from './shared'
import {
  getGroupContext,
  getSenderLabel,
  handleChatMessage,
  handleListSessions,
  handleNewSession,
  handleSummarize,
  handleSwitchSession,
  handleWorkspaceInfo,
  loadConfigs,
  pushToGroupBuffer,
  setBot,
} from './shared'

/** Bot handle wrapping a discord.js Client */
class DiscordBotHandle implements BotHandle {
  constructor(private client: Client) {}

  stop() {
    this.client.destroy()
  }
}

/** Debug log — only prints in dev mode or when DEBUG env is set */
function debug(...args: any[]) {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    console.log('[DiscordBot]', ...args)
  }
}

export async function startDiscordBot(config: MessengerConfig) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    // Required for DMs: when a user sends the first DM to the bot, the DM
    // channel is not yet cached. Partials.Channel allows discord.js to
    // construct a partial channel object so the message is not dropped.
    partials: [Partials.Channel, Partials.Message],
  })

  client.once(Events.ClientReady, (readyClient) => {
    console.log(
      `[Messenger] Discord bot "${config.provider}" logged in as ${readyClient.user?.tag}`,
    )
    debug(
      `Bot is in ${client.guilds.cache.size} guild(s):`,
      client.guilds.cache.map((g) => `${g.name} (${g.id})`).join(', '),
    )
  })

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.id === client.user?.id) return

    // If the message is partial (uncached), fetch the full message
    if (message.partial) {
      try {
        await message.fetch()
      } catch {
        return
      }
    }

    const isPrivate = message.channel.isDMBased()
    const chatType = isPrivate ? 'dm' : 'guild'
    const content = message.content || ''

    debug(
      `MessageCreate fired: author="${message.author.username}"(${message.author.id}) channel="${message.channel.id}" type=${chatType} content="${content.slice(0, 80)}"`,
    )

    if (!isPrivate && client.user) {
      debug(
        `  mentions bot: ${message.mentions.has(client.user)} | mention list: ${message.mentions.users.map((u) => u.id).join(',')}`,
      )
    }

    console.log(
      `[Messenger] text received: chatType="${chatType}" from="${message.author.id}" text="${content.slice(0, 100)}"`,
    )

    // Reload the latest config for this bot on every message
    let botConfig = config
    try {
      const configs = await loadConfigs()
      const fresh = configs.find((cfg) => cfg.id === config.id)
      if (fresh) botConfig = fresh
    } catch {
      // Fall back to closure config
    }

    const messengerCtx = {
      reply: (text: string): Promise<void> =>
        message.reply(text).then(() => {}),
      replyWithMarkdown: (text: string): Promise<void> =>
        message
          .reply(text.replace(/[_*`[]/g, '').replace(/^#+\s*/gm, ''))
          .then(() => {}),
    }

    const chatId = message.channel.id

    // Non-DM chats (guild channels): buffer messages and only respond when mentioned
    if (!isPrivate) {
      const senderLabel = getSenderLabel({
        id: Number(message.author.id),
        username: message.author.username,
        first_name: message.author.displayName,
        last_name: undefined,
      })
      const contextSize = botConfig.contextSize || 100
      pushToGroupBuffer(
        config.id,
        chatId,
        `${senderLabel}: ${content}`,
        contextSize,
      )

      if (!client.user || !message.mentions.has(client.user)) {
        debug(`ignoring non-mentioned guild message from ${senderLabel}`)
        return
      }
    }

    // Private messages: buffer conversation context
    if (isPrivate && chatId) {
      const senderLabel = getSenderLabel({
        id: Number(message.author.id),
        username: message.author.username,
        first_name: message.author.displayName,
        last_name: undefined,
      })
      const contextSize = botConfig.contextSize || 100
      pushToGroupBuffer(
        config.id,
        chatId,
        `${senderLabel}: ${content}`,
        contextSize,
      )
    }

    // Access control: whitelist check
    if (!botConfig.whitelist || botConfig.whitelist.length === 0) {
      debug(`whitelist empty — denying ${message.author.id}`)
      message.reply("Sorry, I'm not allowed to talk to you.")
      return
    }
    const senderId = message.author.id
    const senderUsername = message.author.username
      ? `@${message.author.username.toLowerCase()}`
      : ''
    const senderGlobalName = message.author.globalName
      ? message.author.globalName.toLowerCase()
      : ''
    debug(
      `whitelist check: id="${senderId}" username="${senderUsername}" globalName="${senderGlobalName}" whitelist=[${(botConfig.whitelist || []).join(',')}]`,
    )
    const isAllowed = botConfig.whitelist.some((entry) => {
      const normalized = entry.trim().toLowerCase()
      return (
        normalized === senderId ||
        normalized === senderUsername ||
        normalized === senderUsername.replace('@', '') ||
        normalized === senderGlobalName
      )
    })
    if (!isAllowed) {
      debug(`whitelist denied ${message.author.id}`)
      message.reply("Sorry, I'm not allowed to talk to you.")
      return
    }

    const rawText = content.trim()
    const cleanText = rawText.replace(/<@!?(\d+)>\s*/g, '').trim()

    // Enrich with group context for guild channels
    let userText = cleanText
    if (!isPrivate && chatId) {
      const context = getGroupContext(config.id, chatId)
      if (context) {
        userText = `[Recent conversation]:\n${context}\n\n[My message]: ${cleanText}`
      }
    }

    debug(`routing command: "${cleanText}"`)

    if (cleanText === '?') {
      handleWorkspaceInfo(botConfig, messengerCtx)
    } else if (cleanText === '/summarize') {
      handleSummarize(botConfig, messengerCtx)
    } else if (cleanText === '/new-session') {
      handleNewSession(botConfig, messengerCtx)
    } else if (cleanText === '/list-sessions') {
      handleListSessions(botConfig, messengerCtx)
    } else if (cleanText.startsWith('/switch-session')) {
      const args = cleanText.slice('/switch-session'.length).trim()
      handleSwitchSession(botConfig, messengerCtx, args)
    } else {
      handleChatMessage(botConfig, messengerCtx, userText)
    }
  })

  client.on(Events.Error, (err) => {
    console.error(`[Messenger] Discord error for "${config.provider}":`, err)
  })

  setBot(config.id, new DiscordBotHandle(client))
  client
    .login(config.apiKey)
    .catch((err) =>
      console.error(
        `[Messenger] Discord "${config.provider}" login failed:`,
        err,
      ),
    )
}
