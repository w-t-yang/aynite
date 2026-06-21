/**
 * Messenger Runtime — orchestrates Telegram and Discord bot lifecycle.
 *
 * reloadMessengers() is called whenever the messengers config changes.
 * It starts new bots, stops removed ones, and skips running ones.
 */

import { startDiscordBot } from './discord'
import { deleteBot, getAllBotIds, getBot, loadConfigs, setBot } from './shared'
import { startTelegramBot } from './telegram'

// ─── Bot Lifecycle ──────────────────────────────────────────────────────

/** Stop a bot using its handle's stop() method */
function stopBot(id: string) {
  const handle = getBot(id)
  if (handle) {
    handle.stop()
    deleteBot(id)
  }
}

export async function reloadMessengers() {
  console.log('[Messenger] reloadMessengers called')
  const configs = await loadConfigs()
  const runningIds = getAllBotIds()
  console.log(
    `[Messenger] ${configs.length} configs, ${runningIds.length} running`,
  )

  const nextIds = new Set(
    configs.filter((c) => c.enabled && c.apiKey).map((c) => c.id),
  )

  // Stop bots that are no longer enabled or have been removed
  for (const id of runningIds) {
    if (!nextIds.has(id)) {
      console.log(`[Messenger] stopping bot ${id}`)
      stopBot(id)
    }
  }

  // Start new bots
  for (const c of configs) {
    if (!c.enabled || !c.apiKey) {
      console.log(
        `[Messenger] ${c.provider} skipped (${!c.enabled ? 'disabled' : 'no API key'})`,
      )
      continue
    }
    if (getBot(c.id)) {
      console.log(`[Messenger] ${c.provider} already running`)
      continue
    }

    console.log(`[Messenger] ${c.provider} starting...`)

    // Create a no-op BotHandle placeholder so hasBot() returns true
    // during async startup (prevents double-launch race)
    setBot(c.id, { stop: () => {} })

    if (c.provider === 'telegram') {
      startTelegramBot(c).catch((err) =>
        console.error(`[Messenger] Telegram "${c.provider}" failed:`, err),
      )
    } else if (c.provider === 'discord') {
      startDiscordBot(c).catch((err) =>
        console.error(`[Messenger] Discord "${c.provider}" failed:`, err),
      )
    } else {
      console.warn(`[Messenger] Unknown provider: ${c.provider}`)
      deleteBot(c.id)
    }
  }
}
