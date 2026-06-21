/**
 * Handlers for messenger config (Telegram bots, etc.).
 * Stored in its own file: ~/.aynite/config/messengers.json
 */

import { AppEvents } from '../../../lib/constants/app'
import { getMessengersConfigPath, readJson, writeJson } from '../../../lib/path'
import type { MessengerConfig } from '../../../lib/types/ai'
import { broadcastAppEvent } from '../../ipc-utils'
import { reloadMessengers } from '../../messengers'
import type { ConfigHandler } from '../handler-registry'

export const messengerHandlers: ConfigHandler = (() => ({
  get: async (key: string) => {
    switch (key) {
      case 'messengers': {
        const configs = await readJson<MessengerConfig[]>(
          getMessengersConfigPath(),
          [],
        )
        return Array.isArray(configs) ? configs : []
      }
      default:
        return null
    }
  },
  set: async (key: string, payload: any) => {
    switch (key) {
      case 'messengers': {
        const dataPath = getMessengersConfigPath()
        await writeJson(dataPath, payload)
        // Notify all windows so UI refreshes
        broadcastAppEvent(AppEvents.CONFIG_CHANGED, { key: 'messengers' })
        // Reload bots in the background (start enabled, stop disabled)
        reloadMessengers().catch((err) =>
          console.error('[Messenger] Failed to reload bots:', err),
        )
        return true
      }
      default:
        return false
    }
  },
}))()
