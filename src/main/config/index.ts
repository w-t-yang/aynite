import { ipcMain } from 'electron'
import { AppEvents } from '../../lib/constants/app'
import { ConfigKey } from '../../lib/constants/config'
import { ConfigChannels } from '../../lib/constants/ipc-channels'
import { sendAppEvent } from '../window'
import { loadConfig, saveConfig } from './logic'
import { routeGetConfig, routeSetConfig } from './router'

interface ConfigGetPayload {
  key: string
  payload?: any
}

interface ConfigSetPayload {
  key: string
  payload: any
}

export function setupConfigIpc() {
  ipcMain.handle(ConfigChannels.LOAD, async () => {
    return await loadConfig()
  })

  ipcMain.handle(ConfigChannels.SAVE, async (_event, config: any) => {
    await saveConfig(config)
    return true
  })

  ipcMain.handle(
    ConfigChannels.GET,
    async (_event, { key, payload }: ConfigGetPayload) => {
      return await routeGetConfig(key, payload)
    },
  )

  ipcMain.handle(
    ConfigChannels.SET,
    async (_event, { key, payload }: ConfigSetPayload) => {
      const result = await routeSetConfig(key, payload)
      // Broadcast theme changes via the unified app event channel
      if (key === ConfigKey.ACTIVE_THEME) {
        sendAppEvent(AppEvents.THEME_CHANGED, { themeId: payload })
      } else if (key === ConfigKey.THEME) {
        const themeId = (payload as { id: string }).id
        sendAppEvent(AppEvents.THEME_CHANGED, { themeId })
      }
      return result
    },
  )
}

export * from './logic'
