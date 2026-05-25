import { ipcMain } from 'electron'
import { AppEvents } from '../../lib/constants/app'
import { ConfigKey } from '../../lib/constants/config'
import { ConfigChannels } from '../../lib/constants/ipc-channels'
import { broadcastAppEvent, sendToWindow } from '../window'
import { getWinIdFromSender } from '../window-state'
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
    async (event, { key, payload }: ConfigGetPayload) => {
      const winId = getWinIdFromSender(event.sender)
      return await routeGetConfig(key, payload, winId)
    },
  )

  ipcMain.handle(
    ConfigChannels.SET,
    async (event, { key, payload }: ConfigSetPayload) => {
      const winId = getWinIdFromSender(event.sender)
      const result = await routeSetConfig(key, payload, winId)
      // Broadcast global changes to all windows
      if (key === ConfigKey.ACTIVE_THEME || key === ConfigKey.THEME) {
        const themeId =
          key === ConfigKey.ACTIVE_THEME
            ? payload
            : (payload as { id: string }).id
        broadcastAppEvent(AppEvents.THEME_CHANGED, { themeId })
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
        broadcastAppEvent(AppEvents.CONFIG_CHANGED, { key })
      } else if (key === ConfigKey.ACTIVE_FILE) {
        // Active file change is window-scoped
        sendToWindow(winId, AppEvents.ACTIVE_FILE_CHANGED, { path: payload })
      }
      // Note: ACTIVE_SESSION_CHANGED is already sent by routeSetConfig (router.ts)
      // to ensure it fires even for non-SET pathways. Do NOT duplicate here.
      return result
    },
  )
}

export { getIgnorePatterns } from './ignore'
export { initAppFolders, loadConfig, saveConfig } from './logic'
