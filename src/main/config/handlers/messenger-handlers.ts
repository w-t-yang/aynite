/**
 * Handlers for messenger config (Telegram bots, etc.).
 * Stored in its own file: ~/.aynite/config/messengers.json
 */

import { getMessengersConfigPath, readJson, writeJson } from '../../../lib/path'
import type { MessengerConfig } from '../../../lib/types/ai'
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
        return true
      }
      default:
        return false
    }
  },
}))()
