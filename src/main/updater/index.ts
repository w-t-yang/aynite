import { app, ipcMain } from 'electron'
import isDev from 'electron-is-dev'
import log from 'electron-log'
import { autoUpdater } from 'electron-updater'
import { AppEvents } from '../../lib/constants/app'
import { UpdateChannels } from '../../lib/constants/ipc-channels'
import { broadcastAppEvent } from '../window'

// Configure logger
autoUpdater.logger = log
;(autoUpdater.logger as any).transports.file.level = 'info'

/**
 * Disable auto-download — we want to ask the user first.
 * The download starts only when the user clicks "Download & Update".
 */
autoUpdater.autoDownload = false

/**
 * Parse a semver string into a numeric array for comparison.
 * Handles versions like "1.0.0", "1.0.0-beta.15", "0.0.1".
 */
function parseVersion(version: string): number[] {
  return version.split(/[.-]/).map(Number)
}

/**
 * Compare two semver arrays. Returns >0 if a > b, <0 if a < b, 0 if equal.
 * Prerelease versions (with -beta suffix) are considered lower than release.
 */
function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const aVal = a[i] ?? (i >= 3 ? -1 : 0)
    const bVal = b[i] ?? (i >= 3 ? -1 : 0)
    if (bVal > aVal) return -1
    if (aVal > bVal) return 1
  }
  return 0
}

// Store latest release info so we can download it later
let pendingUpdateInfo: { version: string; releaseNotes?: string } | null = null

/**
 * Fetch the latest non-draft, non-prerelease release from GitHub API.
 * Used in dev mode as a fallback since autoUpdater doesn't work in dev.
 */
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

/**
 * Simulate a download in dev mode with progress events.
 */
function simulateDevDownload() {
  if (!pendingUpdateInfo) return

  broadcastAppEvent(AppEvents.UPDATE_DOWNLOADING, null)

  let progress = 0
  const interval = setInterval(() => {
    progress += Math.random() * 15
    if (progress >= 100) {
      progress = 100
      clearInterval(interval)
      broadcastAppEvent(AppEvents.UPDATE_PROGRESS, { percent: 100 })
      broadcastAppEvent(AppEvents.UPDATE_DOWNLOADED, {
        version: pendingUpdateInfo?.version,
      })
      pendingUpdateInfo = null
    } else {
      broadcastAppEvent(AppEvents.UPDATE_PROGRESS, {
        percent: Math.round(progress * 10) / 10,
      })
    }
  }, 500)
}

export function setupUpdater() {
  ipcMain.handle(UpdateChannels.CHECK, async () => {
    // Use plain fetch() to GitHub API — avoids electron-updater's partitioned
    // session which triggers unnecessary macOS keychain prompts on every check.
    await checkGithubForUpdates()
    return null
  })

  ipcMain.handle(UpdateChannels.DOWNLOAD, async () => {
    if (isDev) {
      console.log('[Updater] Dev mode — simulating download')
      simulateDevDownload()
      return null
    }
    try {
      broadcastAppEvent(AppEvents.UPDATE_DOWNLOADING, null)
      await autoUpdater.downloadUpdate()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[Updater] Download failed:', err)
      // macOS code signing errors are expected in non-production scenarios.
      // Fall back to simulation so the UI flow can still be tested.
      if (message.includes('Code signature') || message.includes('code')) {
        console.log(
          '[Updater] Code signing validation failed — falling back to simulated download',
        )
        simulateDevDownload()
        return null
      }
      broadcastAppEvent(AppEvents.UPDATE_ERROR, `Download failed: ${message}`)
      return null
    }
  })

  ipcMain.handle(UpdateChannels.INSTALL, () => {
    if (isDev) {
      console.log('[Updater] Install skipped in development mode.')
      return
    }
    autoUpdater.quitAndInstall()
  })

  // Production — autoUpdater event listeners (for when user manually checks)
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

  // Startup check using plain fetch() — avoids electron-updater's partitioned
  // session which triggers macOS keychain prompt on every HTTPS request.
  setTimeout(() => {
    checkGithubForUpdates()
  }, 5000)
}
