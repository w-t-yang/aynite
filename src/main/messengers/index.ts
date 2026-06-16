/**
 * Messenger Runtime — manages Telegram bot polling across configured messengers.
 *
 * On app start, reads messenger configs from ~/.aynite/config/messengers.json.
 * For each enabled Telegram bot, creates a Telegraf instance with long-polling.
 * Listens for /start and text messages, currently replies with "WIP".
 *
 * Bots are stopped when config changes (handled externally by re-start).
 */

import { readFileSync } from 'node:fs'
import { getMessengersConfigPath } from '../../lib/path/resolve'
import type { MessengerConfig } from '../../lib/types/ai'

interface ActiveBot {
  config: MessengerConfig
  stop: () => void
}

const activeBots = new Map<string, ActiveBot>()

function loadMessengerConfigs(): MessengerConfig[] {
  try {
    const data = readFileSync(getMessengersConfigPath(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function startMessengerBot(config: MessengerConfig) {
  if (activeBots.has(config.id)) return // Already running

  // Dynamic import of telegraf (ESM module)
  const { Telegraf } = await import('telegraf')

  const bot = new Telegraf(config.apiKey)

  // Handle /start command
  bot.start((ctx) => {
    ctx.reply(
      "Connected to Aynite. Send me a message and I'll forward it to your AI assistant.",
    )
  })

  // Handle text messages — currently WIP
  bot.on('text', (ctx) => {
    ctx.reply('WIP')
  })

  // Start polling
  await bot.launch()

  const stop = () => {
    bot.stop()
  }

  activeBots.set(config.id, { config, stop })
  console.log(
    `[Messenger] Telegram bot "${config.name}" started for workspace "${config.workspace}"`,
  )
}

export async function stopMessengerBot(id: string) {
  const entry = activeBots.get(id)
  if (entry) {
    entry.stop()
    activeBots.delete(id)
    console.log(`[Messenger] Bot "${entry.config.name}" stopped`)
  }
}

export function stopAllBots() {
  for (const [id] of activeBots) {
    stopMessengerBot(id)
  }
}

/**
 * Initialize all enabled messenger bots from config.
 * Called once at app startup.
 */
export async function initMessengers() {
  const configs = loadMessengerConfigs()
  for (const config of configs) {
    if (config.enabled && config.apiKey && config.name && config.workspace) {
      try {
        await startMessengerBot(config)
      } catch (err) {
        console.error(`[Messenger] Failed to start bot "${config.name}":`, err)
      }
    }
  }
}

/**
 * Reload all messenger bots from config.
 * Stops all running bots, re-reads config, starts enabled ones.
 */
export async function reloadMessengers() {
  stopAllBots()
  // Small delay to ensure all bots are fully stopped
  await new Promise((resolve) => setTimeout(resolve, 500))
  await initMessengers()
}
