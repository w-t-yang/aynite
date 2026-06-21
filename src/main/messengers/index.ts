/**
 * Messenger Runtime — orchestrates Telegram and Discord bot lifecycle.
 *
 * reloadMessengers() is called whenever the messengers config changes.
 * It starts new bots, stops removed ones, and skips running ones.
 */

import { ipcMain } from 'electron'
import { MessengerChannels } from '../../lib/constants/ipc-channels'
import { startDiscordBot } from './discord'
import {
  deleteBot,
  getAllBotIds,
  getBot,
  loadConfigs,
  setBot,
  updateBotConnectionStatus,
} from './shared'
import { startTelegramBot } from './telegram'

// ─── Bot Lifecycle ──────────────────────────────────────────────────────

/** Stop a bot using its handle's stop() method */
function stopBot(id: string) {
  const handle = getBot(id)
  if (handle) {
    handle.stop()
    deleteBot(id)
  }
  updateBotConnectionStatus(id, false).catch(() => {})
}

export async function reloadMessengers() {
  console.log('[Messenger] reloadMessengers called')
  const configs = await loadConfigs()
  const runningIds = getAllBotIds()
  console.log(
    `[Messenger] ${configs.length} configs, ${runningIds.length} running`,
  )

  const activeConfigs = configs.filter((c) => c.enabled && c.apiKey)
  const nextIds = new Set(activeConfigs.map((c) => c.id))

  // Stop bots that are no longer enabled or have been removed
  // Also restart bots that already have a handle (config may have changed)
  for (const id of runningIds) {
    if (!nextIds.has(id)) {
      console.log(`[Messenger] stopping bot ${id} (removed/disabled)`)
      stopBot(id)
    } else {
      // Restart: stop existing instance, it will be started again below
      console.log(`[Messenger] restarting bot ${id}`)
      const handle = getBot(id)
      if (handle) {
        handle.stop()
        deleteBot(id)
      }
    }
  }

  // Start all active bots
  for (const c of activeConfigs) {
    if (getBot(c.id)) {
      // Should not happen since we just stopped all, but guard anyway
      continue
    }

    console.log(`[Messenger] ${c.provider} (${c.id}) starting...`)

    // Create a no-op BotHandle placeholder to prevent double-launch
    setBot(c.id, { stop: () => {} })

    if (c.provider === 'telegram') {
      startTelegramBot(c).catch((err) => {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[Messenger] Telegram "${c.provider}" failed:`, errorMsg)
        updateBotConnectionStatus(c.id, false, errorMsg).catch(() => {})
      })
    } else if (c.provider === 'discord') {
      startDiscordBot(c).catch((err) => {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[Messenger] Discord "${c.provider}" failed:`, errorMsg)
        updateBotConnectionStatus(c.id, false, errorMsg).catch(() => {})
      })
    } else {
      console.warn(`[Messenger] Unknown provider: ${c.provider}`)
      deleteBot(c.id)
    }
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────

export function setupMessengerIpc() {
  ipcMain.handle(
    MessengerChannels.TEST,
    async (
      _event,
      { provider, apiKey }: { provider: string; apiKey: string },
    ) => {
      try {
        if (provider === 'telegram') {
          const { Telegraf } = await import('telegraf')
          const bot = new Telegraf(apiKey)
          const botInfo = await bot.telegram.getMe()
          return {
            success: true,
            botName: botInfo.username ? `@${botInfo.username}` : undefined,
          }
        } else if (provider === 'discord') {
          const { Client, Events, GatewayIntentBits } = await import(
            'discord.js'
          )
          const client = new Client({
            intents: [GatewayIntentBits.Guilds],
          })
          const result = await new Promise<{
            success: true
            botName?: string
          }>((resolve, reject) => {
            const timeout = setTimeout(() => {
              client.destroy()
              reject(new Error('Connection timed out after 10 seconds'))
            }, 10000)

            client.once(Events.ClientReady, (readyClient) => {
              clearTimeout(timeout)
              const tag = readyClient.user?.tag
              client.destroy()
              resolve({
                success: true,
                botName: tag,
              })
            })

            client.once(Events.Error, (err) => {
              clearTimeout(timeout)
              client.destroy()
              reject(err)
            })

            client.login(apiKey).catch((err) => {
              clearTimeout(timeout)
              client.destroy()
              reject(err)
            })
          })
          return result
        }
        return { success: false, error: `Unknown provider: ${provider}` }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    },
  )
}
