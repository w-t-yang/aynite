/**
 * Messenger Runtime — manages Telegram bot polling across configured messengers.
 */

import { getMessengersConfigPath, readJson } from '../../lib/path'
import type { MessengerConfig } from '../../lib/types/ai'

const bots = new Map<string, import('telegraf').Telegraf>()

function loadConfigs(): Promise<MessengerConfig[]> {
  return readJson<MessengerConfig[]>(getMessengersConfigPath(), [])
}

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

  // Start new bots — store in Map immediately, launch without awaiting
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
      bot.on('text', (ctx) => ctx.reply('WIP'))
      bots.set(c.id, bot)
      // Don't await — bot.launch never resolves (infinite polling loop)
      bot
        .launch()
        .catch((err) => console.error(`[Messenger] ${c.name} failed:`, err))
    })()
  }
}
