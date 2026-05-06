import { BrowserWindow, ipcMain } from 'electron'
import { ConfigKey } from '../../lib/constants/config'
import {
  ConfigChannels,
  ConfigEventChannels,
} from '../../lib/constants/ipc-channels'
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
      // Broadcast theme changes to all windows (main renderer + iframe views)
      // Handle both switching themes and editing the current theme
      if (key === ConfigKey.ACTIVE_THEME) {
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(ConfigEventChannels.THEME_CHANGED, payload)
        })
      } else if (key === ConfigKey.THEME) {
        const themeId = (payload as { id: string }).id
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send(ConfigEventChannels.THEME_CHANGED, themeId)
        })
      }
      return result
    },
  )
}

export * from './logic'
