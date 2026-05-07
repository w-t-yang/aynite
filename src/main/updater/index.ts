import { ipcMain } from 'electron'
import isDev from 'electron-is-dev'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { AppEvents } from '../../lib/constants/app'
import { UpdateChannels } from '../../lib/constants/ipc-channels'
import { sendAppEvent } from '../window'

// Configure logger
autoUpdater.logger = log
;(autoUpdater.logger as any).transports.file.level = 'info'

export function setupUpdater() {
  ipcMain.handle(UpdateChannels.CHECK, async () => {
    if (isDev) {
      console.log('Update check skipped in development mode.')
      sendAppEvent(AppEvents.UPDATE_NOT_AVAILABLE, null)
      return null
    }
    try {
      return await autoUpdater.checkForUpdatesAndNotify()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('Failed to check for updates:', err)
      sendAppEvent(AppEvents.UPDATE_ERROR, message)
      return null
    }
  })

  ipcMain.handle(UpdateChannels.INSTALL, () => {
    if (isDev) {
      console.log('Update install skipped in development mode.')
      return
    }
    autoUpdater.quitAndInstall()
  })

  if (isDev) {
    return
  }

  // Check for updates every hour
  setInterval(
    () => {
      autoUpdater.checkForUpdatesAndNotify()
    },
    60 * 60 * 1000,
  )

  // Initial check
  autoUpdater.checkForUpdatesAndNotify()
}
