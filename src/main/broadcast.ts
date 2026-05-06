import { BrowserWindow } from 'electron'
import { AppEventChannels } from '../lib/constants/ipc-channels'

/**
 * Broadcast a typed event to the main renderer (and through it, to iframe views).
 *
 * This is the single push mechanism for main → renderer → views communication.
 * The main renderer's AppEventRelay picks up the event, processes it, and
 * relays to iframes via postMessage (since webContents.send doesn't reach
 * subframe preloads in Electron).
 *
 * @param type  Event type string (e.g. 'theme-changed')
 * @param data  Optional payload
 */
export function broadcastAppEvent(type: string, data?: unknown) {
  const payload = { type, data }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(AppEventChannels.BROADCAST, payload)
  }
}
