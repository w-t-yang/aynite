import { app, clipboard, ipcMain, net, protocol, shell } from 'electron'
import {
  exists,
  expandHome,
  copy as fsCopy,
  getBasename,
  joinPaths,
  toUnixPath,
} from '../../lib/path'
import {
  closeWindowBySender,
  getWinIdFromSender,
  minimizeWindowBySender,
  sendToWindow,
  toggleDevToolsForSender,
  toggleMaximizeBySender,
} from '../ipc-utils'
import { createNewWindow, showOpenDialog, showSaveDialog } from '../window'
import { getAvailableViews, getSystemFonts } from './logic'

let clipboardPath: string | null = null

// ─── Channel constants ────────────────────────────────────────────────────
import { AppEvents } from '../../lib/constants/app'
import {
  LoggerChannels,
  SystemChannels,
} from '../../lib/constants/ipc-channels'

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
    minimizeWindowBySender(event.sender)
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_MAXIMIZE, (event) => {
    toggleMaximizeBySender(event.sender)
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_CLOSE, (event) => {
    closeWindowBySender(event.sender)
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_NEW, () => {
    createNewWindow()
    return true
  })

  ipcMain.handle(SystemChannels.WINDOW_DEVTOOLS, (event) => {
    toggleDevToolsForSender(event.sender)
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

  // Forward renderer console.log to main process for debugging
  ipcMain.handle(
    LoggerChannels.LOG,
    (_event, level: string, ...args: unknown[]) => {
      const prefix = '[Renderer]'
      switch (level) {
        case 'error':
          console.error(prefix, ...args)
          break
        case 'warn':
          console.warn(prefix, ...args)
          break
        default:
          console.log(prefix, ...args)
      }
      return true
    },
  )
}

export function setupProtocol() {
  // aynite:// protocol for internal views
  protocol.handle('aynite', async (request) => {
    const url = request.url.replace('aynite://', '')
    try {
      // Strip hash fragment — Electron protocol.handle includes the hash
      // in the URL (unlike HTTP), but we only need the path to the HTML file.
      // The hash is parsed by the view itself via window.location.hash.
      const pathPart = url.split('#')[0]
      const decodedPath = decodeURIComponent(pathPart)
      let filePath = ''

      if (decodedPath.includes('assets/')) {
        // Redirect asset requests to ~/.aynite/assets
        const assetPath = decodedPath.split('assets/').pop()
        if (assetPath) {
          filePath = expandHome(joinPaths('~/.aynite', 'assets', assetPath))
        }
      } else {
        filePath = expandHome(joinPaths('~/.aynite', 'views', decodedPath))
        // If the path has a query string (?param=value), strip it
        // to get the clean file path.
        if (filePath.includes('?')) {
          filePath = filePath.split('?')[0]
        }
      }

      // On Windows, file:// URLs need forward slashes (e.g. file:///C:/path/to/file).
      // Node.js path.join() returns backslashes on Windows, so we must normalize.
      const unixPath = toUnixPath(filePath)
      const prefix = unixPath.startsWith('/') ? '' : '/'
      const fileUrl = `file://${prefix}${unixPath}`
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
      // Strip hash and query from the URL path before decoding
      const pathPart = url.split('#')[0].split('?')[0]
      const decodedPath = decodeURIComponent(pathPart)
      const unixPath = toUnixPath(decodedPath)

      // On Windows, Chromium's URL parser may consume the colon after a
      // drive letter (e.g. "C:"), treating "C" as a hostname and ":" as a
      // port separator. The extracted path then looks like "C/Users/..."
      // instead of "C:/Users/...". Re-add the colon if this pattern is
      // detected.
      const fixedPath = toUnixPath(
        unixPath.replace(
          /^([A-Za-z])(\/)/,
          (_, letter: string, slash: string) => `${letter}:${slash}`,
        ),
      )

      const filePath = `${fixedPath.startsWith('/') ? '' : '/'}${fixedPath}`
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

export type { ShellConfig } from './logic'
export {
  execInUserShell,
  getAvailableViews,
  getShellConfig,
  getSystemFonts,
} from './logic'
