import { app, ipcMain, shell } from 'electron'
import isDev from 'electron-is-dev'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { AppEvents } from '../../lib/constants/app'
import { UpdateChannels } from '../../lib/constants/ipc-channels'
import { broadcastAppEvent } from '../ipc-utils'

// ── Logger ────────────────────────────────────────────────────────────

autoUpdater.logger = log
;(autoUpdater.logger as any).transports.file.level = 'info'

// Don't auto-download — we show a confirmation modal first.
autoUpdater.autoDownload = false

// Allow pre-release versions if current version itself is a pre-release
// (e.g. 1.0.0-beta.19 → alpha/beta releases are visible).
autoUpdater.allowPrerelease = true

// ── Pending update tracking ──────────────────────────────────────────

let pendingUpdateInfo: {
  version: string
  releaseNotes?: string
} | null = null

// ── Periodic re-check interval (6 hours) ──────────────────────────────

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
let periodicCheckTimer: ReturnType<typeof setInterval> | null = null

// ── Version helpers (dev mode only) ───────────────────────────────────

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

// ── Dev mode helpers ──────────────────────────────────────────────────

/**
 * Fetch latest release info from GitHub API.
 * Used only in dev mode where autoUpdater doesn't work (unpackaged app).
 */
async function fetchLatestReleaseFromGithub(): Promise<{
  version: string
  releaseNotes?: string
} | null> {
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
      throw new Error(
        'Could not reach GitHub to check for updates. Check your internet connection.',
      )
    }
    throw new Error(`GitHub API returned ${response.status}`)
  }

  const releases = await response.json()
  // In dev mode, allow pre-release so beta versions are visible
  const release = releases.find((r: any) => !r.draft)

  if (!release) return null

  const version = release.tag_name?.replace(/^v/, '')
  if (!version) return null

  return {
    version,
    releaseNotes: release.body?.slice(0, 500) || undefined,
  }
}

/**
 * Find the right download asset URL for the current platform from a GitHub release.
 *
 * Naming conventions from electron-builder:
 *   - macOS arm64:  Aynite-{version}-arm64.dmg
 *   - macOS x64:    Aynite-{version}.dmg
 *   - Windows:      Aynite Setup {version}.exe
 *   - Linux:        Aynite-{version}.AppImage (or .deb, .rpm)
 */
async function getPlatformAssetUrl(version: string): Promise<string | null> {
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

  const isArmMac = process.arch === 'arm64'
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'

  for (const asset of release.assets) {
    const name: string = asset.name
    // macOS arm64: Aynite-{version}-arm64.dmg
    if (isMac && isArmMac && name.includes('arm64') && name.endsWith('.dmg')) {
      return asset.browser_download_url
    }
    // macOS x64: Aynite-{version}.dmg (without arm64)
    if (
      isMac &&
      !isArmMac &&
      name.endsWith('.dmg') &&
      !name.includes('arm64')
    ) {
      return asset.browser_download_url
    }
    if (isWin && name.endsWith('.exe')) {
      return asset.browser_download_url
    }
    if (
      !isMac &&
      !isWin &&
      (name.endsWith('.AppImage') ||
        name.endsWith('.deb') ||
        name.endsWith('.rpm'))
    ) {
      return asset.browser_download_url
    }
  }
  // Fallback: platform-matched installer, then first asset
  if (isMac) {
    // macOS: only accept .dmg — never fall back to zip
    const dmg = release.assets.find((a: any) => a.name.endsWith('.dmg'))
    if (dmg) return dmg.browser_download_url
  }
  if (isWin) {
    // Windows: .exe
    const exe = release.assets.find((a: any) => a.name.endsWith('.exe'))
    if (exe) return exe.browser_download_url
  }
  if (!isMac && !isWin) {
    // Linux: AppImage, deb, rpm
    const linux = release.assets.find(
      (a: any) =>
        a.name.endsWith('.AppImage') ||
        a.name.endsWith('.deb') ||
        a.name.endsWith('.rpm'),
    )
    if (linux) return linux.browser_download_url
  }
  return release.assets[0]?.browser_download_url || null
}

/**
 * Download a file from url to destination path with progress events.
 * Dev mode only.
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
  if (!reader) throw new Error('Response body has no readable stream')
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
 * Dev mode check: fetch latest release from GitHub API and broadcast result.
 */
async function devCheckForUpdates() {
  const currentVersion = app.getVersion()
  try {
    broadcastAppEvent(AppEvents.UPDATE_CHECKING, null)

    const release = await fetchLatestReleaseFromGithub()

    if (!release) {
      broadcastAppEvent(AppEvents.UPDATE_NOT_AVAILABLE, null)
      return
    }

    const currentParts = parseVersion(currentVersion)
    const latestParts = parseVersion(release.version)
    const comparison = compareVersions(currentParts, latestParts)

    if (comparison < 0) {
      pendingUpdateInfo = {
        version: release.version,
        releaseNotes: release.releaseNotes,
      }
      broadcastAppEvent(AppEvents.UPDATE_AVAILABLE, {
        version: release.version,
        releaseNotes: release.releaseNotes,
      })
    } else {
      broadcastAppEvent(AppEvents.UPDATE_NOT_AVAILABLE, null)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Updater] Dev check failed:', err)
    broadcastAppEvent(AppEvents.UPDATE_ERROR, `Update check failed: ${message}`)
  }
}

/**
 * Returns the directory for storing downloaded update installers.
 * Uses `app.getPath('userData')/__updates__` — a dedicated cache directory
 * that follows the industry standard for Electron apps (similar to how
 * Chrome, VS Code, and other Electron apps store update artifacts).
 *
 * On macOS: ~/Library/Application Support/aynite-app/__updates__/
 * On Windows: ~/.aynite/__updates__/
 * On Linux: ~/.config/aynite-app/__updates__/
 */
async function getUpdatesDir(): Promise<string> {
  const path = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  const updatesDir = path.join(app.getPath('userData'), '__updates__')
  await mkdir(updatesDir, { recursive: true })
  return updatesDir
}

/**
 * Build a standardised filename for the downloaded installer.
 * macOS: Aynite-{version}-{arch}.dmg
 */
function buildInstallerFilename(version: string): string {
  const arch = process.arch === 'arm64' ? '-arm64' : ''
  return `Aynite-${version}${arch}.dmg`
}

/**
 * Dev mode download: download the DMG to the app's dedicated updates cache.
 */
async function devDownloadUpdate(): Promise<void> {
  if (!pendingUpdateInfo) {
    throw new Error('No pending update — check for updates first')
  }

  const version = pendingUpdateInfo.version
  const url = await getPlatformAssetUrl(version)
  if (!url) throw new Error(`Could not find download URL for v${version}`)

  const updatesDir = await getUpdatesDir()
  const filename = buildInstallerFilename(version)
  const destPath = (await import('node:path')).join(updatesDir, filename)

  // Skip download if file already exists
  try {
    const { stat } = await import('node:fs/promises')
    const stats = await stat(destPath)
    if (stats.size > 0) {
      console.log(
        `[Updater] File already exists at ${destPath} — skipping download`,
      )
      broadcastAppEvent(AppEvents.UPDATE_DOWNLOADED, {
        version,
        downloadedFile: destPath,
      })
      return
    }
  } catch {
    // File doesn't exist — proceed with download
  }

  broadcastAppEvent(AppEvents.UPDATE_DOWNLOADING, null)

  await downloadFile(url, destPath, (percent) => {
    broadcastAppEvent(AppEvents.UPDATE_PROGRESS, { percent })
  })

  broadcastAppEvent(AppEvents.UPDATE_PROGRESS, { percent: 100 })

  broadcastAppEvent(AppEvents.UPDATE_DOWNLOADED, {
    version,
    downloadedFile: destPath,
  })
}

/**
 * Dev mode install: open the downloaded DMG file to trigger the macOS
 * disk image mount and install flow. On Windows/Linux, opens the updates
 * directory so the user can run the installer manually.
 */
async function devInstallUpdate(): Promise<void> {
  if (!pendingUpdateInfo) {
    throw new Error('No pending update — check for updates first')
  }

  const version = pendingUpdateInfo.version
  const updatesDir = await getUpdatesDir()
  const path = await import('node:path')
  const { readdir } = await import('node:fs/promises')

  // Find the downloaded file matching this version
  const files = await readdir(updatesDir)
  const installer = files.find((f) => f.includes(version))
  if (!installer) {
    // Fallback: just open the folder
    shell.openPath(updatesDir)
    return
  }

  const installerPath = path.join(updatesDir, installer)

  if (process.platform === 'darwin') {
    // On macOS, open the DMG — it auto-mounts and shows the standard
    // drag-to-Applications install dialog.
    shell.openPath(installerPath)
  } else {
    // On Windows/Linux, open the folder so the user can run the installer
    shell.openPath(updatesDir)
  }
}

// ── Production autoUpdater event listeners ────────────────────────────

function setupAutoUpdaterListeners() {
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

  // Periodic re-check
  periodicCheckTimer = setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] Periodic check failed:', err)
    })
  }, UPDATE_CHECK_INTERVAL_MS)
}

// ── IPC Handlers ──────────────────────────────────────────────────────

export function setupUpdater() {
  // ── CHECK ─────────────────────────────────────────────────────────
  ipcMain.handle(UpdateChannels.CHECK, async () => {
    if (isDev) {
      await devCheckForUpdates()
    } else {
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
    if (isDev) {
      console.log('[Updater] Dev mode — downloading update')
      try {
        await devDownloadUpdate()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Updater] Dev download failed:', err)
        broadcastAppEvent(AppEvents.UPDATE_ERROR, `Download failed: ${message}`)
      }
    } else {
      broadcastAppEvent(AppEvents.UPDATE_DOWNLOADING, null)
      try {
        await autoUpdater.downloadUpdate()
        // autoUpdater emits 'update-downloaded' on success via its listener
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[Updater] Download failed:', err)
        broadcastAppEvent(AppEvents.UPDATE_ERROR, `Download failed: ${message}`)
      }
    }
    return null
  })

  // ── INSTALL ────────────────────────────────────────────────────────
  ipcMain.handle(UpdateChannels.INSTALL, async () => {
    if (isDev) {
      await devInstallUpdate()
    } else {
      autoUpdater.quitAndInstall()
    }
    return null
  })

  // ── Setup autoUpdater listeners (production only) ─────────────────
  if (isDev) {
    console.log('[Updater] Dev mode — autoUpdater disabled')
  } else {
    setupAutoUpdaterListeners()
  }

  // ── Startup check ──────────────────────────────────────────────────
  // In production: use autoUpdater with a delay to avoid keychain prompt
  // on cold start. In dev: use plain GitHub API fetch.
  setTimeout(() => {
    if (isDev) {
      devCheckForUpdates()
    } else {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[Updater] Startup check failed:', err)
      })
    }
  }, 5000)
}

// Cleanup on app quit
export function cleanupUpdater() {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer)
    periodicCheckTimer = null
  }
}
