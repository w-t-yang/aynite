import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  net,
  protocol,
  shell,
} from 'electron'
import {
  exists,
  expandHome,
  copy as fsCopy,
  getBasename,
  joinPaths,
} from '../../lib/path'
import {
  createNewWindow,
  sendToWindow,
  showOpenDialog,
  showSaveDialog,
} from '../window'
import { getWinIdFromSender } from '../window-state'
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

  ipcMain.handle(SystemChannels.DIALOG_SAVE_FILE, async () => {
    const { canceled, filePath } = await showSaveDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (canceled || !filePath) return null
    return filePath
  })

  ipcMain.handle(SystemChannels.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
    }
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.close()
    }
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_NEW, () => {
    createNewWindow()
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
    async (event, tileId: string) => {
      const winId = getWinIdFromSender(event.sender)
      sendToWindow(winId, AppEvents.TILE_ACTIVATED, tileId)
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

  // MIME types for media files served via range requests
  const _mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    ogg: 'video/ogg',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    aac: 'audio/aac',
    m4a: 'audio/mp4',
    opus: 'audio/ogg',
    wma: 'audio/x-ms-wma',
  }

  // aynite-resource:// protocol for arbitrary files
  protocol.handle('aynite-resource', async (request) => {
    const url = request.url.replace('aynite-resource://', '')
    try {
      const decodedPath = decodeURIComponent(url)
      const filePath = `${decodedPath.startsWith('/') ? '' : '/'}${decodedPath}`
      const fileUrl = `file://${filePath}`

      // Let net.fetch handle everything (streaming, content-type detection)
      const response = await net.fetch(fileUrl)

      // Add Accept-Ranges header so the browser knows it can seek
      const headers = new Headers(response.headers)
      headers.set('Accept-Ranges', 'bytes')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (e) {
      console.error('Failed to handle resource request:', e)
      return new Response('File not found', { status: 404 })
    }
  })
}

export { execInUserShell, getAvailableViews, getSystemFonts } from './logic'
