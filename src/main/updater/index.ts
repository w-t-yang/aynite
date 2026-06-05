import path from 'node:path'
import { app, ipcMain, shell } from 'electron'
import isDev from 'electron-is-dev'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { AppEvents } from '../../lib/constants/app'
import { UpdateChannels } from '../../lib/constants/ipc-channels'
import { broadcastAppEvent } from '../window'

// ── Logger ────────────────────────────────────────────────────────────

autoUpdater.logger = log
;(autoUpdater.logger as any).transports.file.level = 'info'

autoUpdater.autoDownload = false

// ── Version helpers ───────────────────────────────────────────────────

function parseVersion(version: string): number[] {
  return version.split(/[.-]/).map(Number)
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const aVal = a[i] ?? (i >= 3 ? -1 : 0)
    const bVal = b[i] ?? (i >= 3 ? -1 : 0)
    if (bVal > aVal) return -1
    if (aVal > bVal) return 1
  }
  return 0
}

// ── Pending update tracking ──────────────────────────────────────────

let pendingUpdateInfo: {
  version: string
  releaseNotes?: string
  /** Whether the download was to ~/Downloads (manual install needed). */
  manualInstall?: boolean
  /** Path where the file was downloaded. */
  downloadedFile?: string
} | null = null

/**
 * Provides the release download URL for a given version from GitHub API.
 * Used in dev mode where autoUpdater can't download.
 */
async function getReleaseDownloadUrl(version: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/w-t-yang/aynite/releases/tags/v${version}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Aynite-App',
        },
      },
    )
    if (!response.ok) return null
    const release = await response.json()
    // Find the platform-appropriate asset
    const isArmMac = process.arch === 'arm64'
    const isMac = process.platform === 'darwin'
    const isWin = process.platform === 'win32'

    for (const asset of release.assets) {
      const name: string = asset.name
      if (isMac && isArmMac && name.includes('arm64-mac.zip')) {
        return asset.browser_download_url
      }
      if (
        isMac &&
        !isArmMac &&
        name.includes('mac.zip') &&
        !name.includes('arm64')
      ) {
        return asset.browser_download_url
      }
      if (isWin && name.endsWith('.exe')) {
        return asset.browser_download_url
      }
      if (!isMac && !isWin && name.endsWith('.AppImage')) {
        return asset.browser_download_url
      }
    }
    // Fallback: first zip or first asset
    const zip = release.assets.find((a: any) => a.name.endsWith('.zip'))
    return (
      zip?.browser_download_url ||
      release.assets[0]?.browser_download_url ||
      null
    )
  } catch {
    return null
  }
}

/**
 * Download a file from url to destination path with progress events.
 */
async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)

  const contentLength = response.headers.get('content-length')
  const total = contentLength ? Number.parseInt(contentLength, 10) : 0
  const reader = response.body?.getReader()
  const { createWriteStream } = await import('node:fs')

  await new Promise<void>((resolve, reject) => {
    const writer = createWriteStream(destPath)
    let received = 0

    const pump = () => {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            writer.end()
            resolve()
            return
          }
          received += value.length
          if (total && onProgress) {
            onProgress(Math.round((received / total) * 1000) / 10)
          }
          writer.write(value, pump)
        })
        .catch(reject)
    }
    pump()
    writer.on('error', reject)
  })
}

/**
 * Direct download to ~/Downloads (or platform-appropriate downloads folder).
 * Used in dev mode where autoUpdater can't download or install.
 */
async function downloadToDownloads(): Promise<string | null> {
  if (!pendingUpdateInfo) {
    throw new Error('No pending update — check for updates first')
  }

  const version = pendingUpdateInfo.version
  const url = await getReleaseDownloadUrl(version)
  if (!url) throw new Error(`Could not find download URL for v${version}`)

  const downloadsPath = app.getPath('downloads')
  const filename = url.split('/').pop() || `Aynite-${version}.zip`
  const destPath = path.join(downloadsPath, filename)

  // Check if file already exists — skip download if it does
  try {
    const { stat } = await import('node:fs/promises')
    const stats = await stat(destPath)
    if (stats.size > 0) {
      console.log(
        `[Updater] File already exists at ${destPath} — skipping download`,
      )
      pendingUpdateInfo = {
        ...pendingUpdateInfo,
        manualInstall: true,
        downloadedFile: destPath,
      }
      broadcastAppEvent(AppEvents.UPDATE_DOWNLOADED, {
        version,
        downloadedFile: destPath,
        manualInstall: true,
      })
      return destPath
    }
  } catch {
    // File doesn't exist — proceed with download
  }

  broadcastAppEvent(AppEvents.UPDATE_DOWNLOADING, null)

  await downloadFile(url, destPath, (percent) => {
    broadcastAppEvent(AppEvents.UPDATE_PROGRESS, { percent })
  })

  broadcastAppEvent(AppEvents.UPDATE_PROGRESS, { percent: 100 })
  pendingUpdateInfo = {
    ...pendingUpdateInfo,
    manualInstall: true,
    downloadedFile: destPath,
  }

  broadcastAppEvent(AppEvents.UPDATE_DOWNLOADED, {
    version,
    downloadedFile: destPath,
    manualInstall: true,
  })

  return destPath
}

// ── GitHub API check (used in dev mode and startup, no keychain) ──────

async function checkGithubForUpdates() {
  const currentVersion = app.getVersion()
  try {
    broadcastAppEvent(AppEvents.UPDATE_CHECKING, null)

    const response = await fetch(
      'https://api.github.com/repos/w-t-yang/aynite/releases?per_page=10',
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Aynite-App',
        },
      },
    )

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        broadcastAppEvent(
          AppEvents.UPDATE_ERROR,
          'Could not reach GitHub to check for updates. Check your internet connection.',
        )
        return
      }
      throw new Error(`GitHub API returned ${response.status}`)
    }

    const releases = await response.json()
    const stableRelease = releases.find((r: any) => !r.draft && !r.prerelease)

    if (!stableRelease) {
      broadcastAppEvent(AppEvents.UPDATE_NOT_AVAILABLE, null)
      return
    }

    const latestVersion = stableRelease.tag_name?.replace(/^v/, '')

    if (!latestVersion) {
      broadcastAppEvent(
        AppEvents.UPDATE_ERROR,
        'Could not determine latest version',
      )
      return
    }

    const currentParts = parseVersion(currentVersion)
    const latestParts = parseVersion(latestVersion)
    const comparison = compareVersions(currentParts, latestParts)

    if (comparison < 0) {
      pendingUpdateInfo = {
        version: latestVersion,
        releaseNotes: stableRelease.body?.slice(0, 500) || undefined,
      }
      broadcastAppEvent(AppEvents.UPDATE_AVAILABLE, {
        ...pendingUpdateInfo,
      })
    } else {
      broadcastAppEvent(AppEvents.UPDATE_NOT_AVAILABLE, null)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Updater] GitHub check failed:', err)
    broadcastAppEvent(AppEvents.UPDATE_ERROR, `Update check failed: ${message}`)
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────

export function setupUpdater() {
  // ── CHECK ─────────────────────────────────────────────────────────
  ipcMain.handle(UpdateChannels.CHECK, async () => {
    if (isDev) {
      // Dev mode: plain fetch to avoid autoUpdater's limitations in unpackaged apps
      await checkGithubForUpdates()
    } else {
      // Production: use autoUpdater so its internal state is set for download/install
      try {
        await autoUpdater.checkForUpdates()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Updater] autoUpdater check failed:', err)
        broadcastAppEvent(
          AppEvents.UPDATE_ERROR,
          `Update check failed: ${message}`,
        )
      }
    }
    return null
  })

  // ── DOWNLOAD ──────────────────────────────────────────────────────
  ipcMain.handle(UpdateChannels.DOWNLOAD, async () => {
    try {
      if (isDev) {
        console.log('[Updater] Dev mode — downloading to ~/Downloads')
        await downloadToDownloads()
      } else {
        broadcastAppEvent(AppEvents.UPDATE_DOWNLOADING, null)
        await autoUpdater.downloadUpdate()
        // autoUpdater emits 'update-downloaded' on success via its event listener
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[Updater] Download failed:', err)

      // If autoUpdater wasn't checked first (e.g. update found by startup check),
      // fall back to direct download to ~/Downloads
      if (message.includes('Please check update first') && !isDev) {
        console.log(
          '[Updater] autoUpdater has no pending update — direct downloading to ~/Downloads',
        )
        try {
          await downloadToDownloads()
          return null
        } catch (dlErr: unknown) {
          const dlMsg = dlErr instanceof Error ? dlErr.message : String(dlErr)
          broadcastAppEvent(AppEvents.UPDATE_ERROR, `Download failed: ${dlMsg}`)
          return null
        }
      }

      broadcastAppEvent(AppEvents.UPDATE_ERROR, `Download failed: ${message}`)
    }
  })

  // ── INSTALL ────────────────────────────────────────────────────────
  ipcMain.handle(UpdateChannels.INSTALL, async () => {
    // If the download went to ~/Downloads (manual install), open that folder
    // Works for both dev mode and production fallback (startup-check path).
    if (isDev || pendingUpdateInfo?.manualInstall) {
      const targetPath = pendingUpdateInfo?.downloadedFile
        ? path.dirname(pendingUpdateInfo.downloadedFile)
        : app.getPath('downloads')
      console.log('[Updater] Opening download location:', targetPath)
      shell.openPath(targetPath)
      return
    }
    autoUpdater.quitAndInstall()
  })

  // ── Event listeners (production only) ──────────────────────────────
  if (!isDev) {
    autoUpdater.on('checking-for-update', () => {
      broadcastAppEvent(AppEvents.UPDATE_CHECKING, null)
    })

    autoUpdater.on('update-available', (info: any) => {
      pendingUpdateInfo = {
        version: info.version,
        releaseNotes: info.releaseNotes,
      }
      broadcastAppEvent(AppEvents.UPDATE_AVAILABLE, {
        version: info.version,
        releaseNotes: info.releaseNotes,
      })
    })

    autoUpdater.on('update-not-available', () => {
      broadcastAppEvent(AppEvents.UPDATE_NOT_AVAILABLE, null)
    })

    autoUpdater.on('error', (err) => {
      broadcastAppEvent(AppEvents.UPDATE_ERROR, err.message)
    })

    autoUpdater.on('download-progress', (progressObj) => {
      broadcastAppEvent(AppEvents.UPDATE_PROGRESS, {
        percent: Math.round(progressObj.percent * 10) / 10,
      })
    })

    autoUpdater.on('update-downloaded', (info: any) => {
      broadcastAppEvent(AppEvents.UPDATE_DOWNLOADED, {
        version: info.version,
      })
    })
  }

  // ── Startup check ──────────────────────────────────────────────────
  // Use plain fetch to avoid macOS keychain prompts on silent startup check.
  setTimeout(() => {
    checkGithubForUpdates()
  }, 5000)
}
