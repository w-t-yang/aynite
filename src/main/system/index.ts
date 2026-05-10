import { app, clipboard, ipcMain, net, protocol, shell } from 'electron'
import {
  exists,
  expandHome,
  copy as fsCopy,
  getBasename,
  joinPaths,
} from '../../lib/path'
import {
  closeWindow,
  maximizeWindow,
  minimizeWindow,
  sendAppEvent,
  showOpenDialog,
} from '../window'
import { getAvailableViews, getSystemFonts } from './logic'

let clipboardPath: string | null = null

// ─── Channel constants ────────────────────────────────────────────────────
import { AppEvents } from '../../lib/constants/app'
import { SystemChannels } from '../../lib/constants/ipc-channels'

export function setupSystemIpc() {
  ipcMain.handle(SystemChannels.FONT_LIST, async () => {
    return await getSystemFonts()
  })

  ipcMain.handle(SystemChannels.OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle(SystemChannels.APP_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(SystemChannels.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.handle(SystemChannels.DIALOG_SELECT_FILE, async () => {
    const { canceled, filePaths } = await showOpenDialog({
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  ipcMain.handle(SystemChannels.DIALOG_SELECT_FOLDER, async () => {
    const { canceled, filePaths } = await showOpenDialog({
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths
  })

  ipcMain.handle(SystemChannels.WINDOW_MINIMIZE, () => {
    minimizeWindow()
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_MAXIMIZE, () => {
    maximizeWindow()
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_CLOSE, () => {
    closeWindow()
    return true
  })

  ipcMain.handle(
    SystemChannels.CLIPBOARD_COPY,
    async (_event, path: string) => {
      clipboardPath = path
      return true
    },
  )

  ipcMain.handle(
    SystemChannels.CLIPBOARD_PASTE,
    async (_event, destDir: string) => {
      if (!clipboardPath) return false
      const fileName = getBasename(clipboardPath)
      const destPath = joinPaths(destDir, fileName)
      if (await exists(clipboardPath)) {
        await fsCopy(clipboardPath, destPath, { recursive: true })
        return true
      }
      return false
    },
  )

  ipcMain.handle(SystemChannels.VIEW_LIST, async () => {
    return await getAvailableViews()
  })

  ipcMain.handle(
    SystemChannels.TILE_ACTIVATE,
    async (_event, tileId: string) => {
      sendAppEvent(AppEvents.TILE_ACTIVATED, tileId)
      return true
    },
  )

  ipcMain.handle(
    SystemChannels.CLIPBOARD_WRITE_TEXT,
    (_event, text: string) => {
      clipboard.writeText(text)
      return true
    },
  )
}

export function setupProtocol() {
  // aynite:// protocol for internal views
  protocol.handle('aynite', async (request) => {
    const url = request.url.replace('aynite://', '')
    try {
      const decodedPath = decodeURIComponent(url)
      let filePath = ''

      if (decodedPath.includes('assets/')) {
        // Redirect asset requests to ~/.aynite/assets
        const assetPath = decodedPath.split('assets/').pop()
        if (assetPath) {
          filePath = expandHome(joinPaths('~/.aynite', 'assets', assetPath))
        }
      } else {
        filePath = expandHome(joinPaths('~/.aynite', 'views', decodedPath))
      }

      const fileUrl = `file://${filePath.startsWith('/') ? '' : '/'}${filePath}`
      return net.fetch(fileUrl)
    } catch (e) {
      console.error('Failed to handle aynite protocol:', e)
      return new Response('View not found', { status: 404 })
    }
  })

  // aynite-resource:// protocol for arbitrary files
  protocol.handle('aynite-resource', (request) => {
    const url = request.url.replace('aynite-resource://', '')
    try {
      const decodedPath = decodeURIComponent(url)
      const fileUrl = `file://${decodedPath.startsWith('/') ? '' : '/'}${decodedPath}`
      return net.fetch(fileUrl)
    } catch (e) {
      console.error('Failed to handle resource request:', e)
      return new Response('File not found', { status: 404 })
    }
  })
}

export { getAvailableViews, getSystemFonts } from './logic'
