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

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(
      `[Messenger] Discord bot "${config.provider}" logged in as ${readyClient.user?.tag}`,
    )
    debug(
      `Bot is in ${client.guilds.cache.size} guild(s):`,
      client.guilds.cache.map((g) => `${g.name} (${g.id})`).join(', '),
    )

    // Store bot display name and broadcast so the UI refreshes
    try {
      const tag = readyClient.user?.tag
      if (tag) {
        const configs = await loadConfigs()
        const updated = configs.map((c) =>
          c.id === config.id ? { ...c, botName: tag } : c,
        )
        await saveConfigsDirect(updated)
        broadcastAppEvent(AppEvents.CONFIG_CHANGED, { key: 'messengers' })
      }
    } catch {
      // Best effort
    }
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

    // Determine chat name early so we can persist every message
    // For guild channels, include the server name to disambiguate identical
    // channel names across different servers (e.g. two servers both with #general).
    const channelName = (message.channel as any)?.name || chatId
    const guildName = message.guild?.name || 'unknown'
    const chatName = isPrivate
      ? `@${message.author.username}`
      : `#${guildName}/${channelName}`

    // Persist ALL messages to chat history (even non-mentioned group messages)
    const senderLabel = getSenderLabel({
      id: Number(message.author.id),
      username: message.author.username,
      first_name: message.author.displayName,
      last_name: undefined,
    })
    saveBotMessage(config.id, chatName, 'user', senderLabel, content).catch(
      () => {},
    )

    // Buffer and check mention for group messages
    if (!isPrivate) {
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

    // Buffer private messages too
    if (isPrivate && chatId) {
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

    // Strip Discord mention syntax <@!id> or <@id> from text before command matching
    const cleanText = content.replace(/<@!?(\d+)>\s*/g, '').trim()
    const cleanLower = cleanText.toLowerCase()

    // ── Busy check: if this chat is already processing, reject all messages ──

    const busyReply = await getBusyReply(config.id, chatName)
    if (busyReply) {
      message.reply(busyReply)
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

    debug(`routing command: "${cleanText}"`)

    if (
      cleanLower === '/?' ||
      cleanLower === '/h' ||
      cleanLower === '/help' ||
      cleanLower === '?'
    ) {
      handleHelp(botConfig, messengerCtx)
    } else if (cleanLower.startsWith('/set-project')) {
      const args = cleanText.slice('/set-project'.length).trim()
      handleSetProject(botConfig, messengerCtx, args)
    } else if (cleanLower.startsWith('/set-agent')) {
      const args = cleanText.slice('/set-agent'.length).trim()
      handleSetAgent(botConfig, messengerCtx, args)
    } else {
      handleChatMessage(
        botConfig,
        messengerCtx,
        cleanText,
        chatName,
        senderLabel,
        groupContextLines,
      )
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
