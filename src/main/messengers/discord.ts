/**
 * Discord messenger adapter using discord.js.
 *
 * Thin adapter — translates Discord's API into the normalized
 * IncomingMessage interface and delegates to processIncomingMessage().
 *
 * Required Discord Developer Portal settings:
 * - Bot → Privileged Gateway Intents → **Message Content Intent** (must be ON)
 *
 * `Partials.Channel` is required in client options — without it, DM channels
 * received for the first time are treated as partial/uncached and the message
 * event is silently dropped by discord.js.
 */

import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import type { MessengerConfig } from '../../lib/types/ai'
import type { BotHandle, IncomingMessage, MessengerContext } from './shared'
import {
  loadConfigs,
  processIncomingMessage,
  setBot,
  updateBotConnectionStatus,
  updateBotName,
} from './shared'

class DiscordBotHandle implements BotHandle {
  constructor(private client: Client) {}
  stop() {
    this.client.destroy()
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
    partials: [Partials.Channel, Partials.Message],
  })

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(
      `[Messenger] Discord bot "${config.provider}" logged in as ${readyClient.user?.tag}`,
    )

    // Mark as connected
    await updateBotConnectionStatus(config.id, true)

    // Store/update bot display name
    const tag = readyClient.user?.tag
    console.log(
      `[Messenger] Discord ClientReady: config.id=${config.id} tag=${tag}`,
    )
    if (tag) {
      await updateBotName(config.id, tag)
    }
  })

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.id === client.user?.id) return

    // Fetch partial messages
    if (message.partial) {
      try {
        await message.fetch()
      } catch {
        return
      }
    }

    // Reload config
    let botConfig = config
    try {
      const configs = await loadConfigs()
      const fresh = configs.find((c) => c.id === config.id)
      if (fresh) botConfig = fresh
    } catch {
      /* use closure config */
    }

    const rawText = message.content || ''
    const isPrivate = message.channel.isDMBased()
    const chatId = message.channel.id

    // Sender info
    const senderLabel = message.author.username
      ? `@${message.author.username}`
      : message.author.displayName || `User ${message.author.id}`
    const senderRaw = message.author.id
    const senderUsername = message.author.username || ''
    const senderExtra = message.author.globalName || ''

    // Chat name (include guild to disambiguate channels across servers)
    const channelName = (message.channel as any)?.name || chatId
    const guildName = message.guild?.name || 'unknown'
    const chatName = isPrivate
      ? `@${message.author.username}`
      : `#${guildName}/${channelName}`

    // Mention detection (Discord: message.mentions.has(client.user))
    const isMentioned =
      isPrivate || (client.user ? message.mentions.has(client.user) : false)

    // Strip <@!id> or <@id> mentions for command matching
    const textWithoutMention = rawText.replace(/<@!?(\d+)>\s*/g, '').trim()

    // Build MessengerContext (Discord doesn't support markdown reply well)
    const messengerCtx: MessengerContext = {
      reply: (text: string) => message.reply(text).then(() => {}),
      replyWithMarkdown: (text: string) =>
        message
          .reply(text.replace(/[_*`[]/g, '').replace(/^#+\s*/gm, ''))
          .then(() => {}),
    }

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
      senderExtra,
    }

    await processIncomingMessage(botConfig, messengerCtx, msg)
  })

  client.on(Events.Error, (err) => {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(
      `[Messenger] Discord error for "${config.provider}":`,
      errorMsg,
    )
    updateBotConnectionStatus(config.id, false, errorMsg).catch(() => {})
  })

  setBot(config.id, new DiscordBotHandle(client))
  client.login(config.apiKey).catch((err) => {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(
      `[Messenger] Discord "${config.provider}" login failed:`,
      errorMsg,
    )
    updateBotConnectionStatus(config.id, false, errorMsg).catch(() => {})
  })
}
