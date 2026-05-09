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
      // Broadcast specific changes via the unified app event channel
      if (key === ConfigKey.ACTIVE_THEME || key === ConfigKey.THEME) {
        const themeId =
          key === ConfigKey.ACTIVE_THEME
            ? payload
            : (payload as { id: string }).id
        sendAppEvent(AppEvents.THEME_CHANGED, { themeId })
      } else if (
        [
          ConfigKey.AI,
          ConfigKey.AGENTS,
          ConfigKey.PROMPTS,
          ConfigKey.SKILLS,
          ConfigKey.COMMANDS,
          ConfigKey.TOOLS,
        ].includes(key as ConfigKey)
      ) {
        sendAppEvent(AppEvents.CONFIG_CHANGED, { key })
      } else if (key === ConfigKey.ACTIVE_FILE) {
        sendAppEvent(AppEvents.ACTIVE_FILE_CHANGED, { path: payload })
      } else if (key === ConfigKey.ACTIVE_SESSION_ID) {
        sendAppEvent(AppEvents.ACTIVE_SESSION_CHANGED, { id: payload })
      }
      return result
    },
  )
}

export { getIgnorePatterns } from './ignore'
export { initAppFolders, loadConfig, saveConfig } from './logic'
