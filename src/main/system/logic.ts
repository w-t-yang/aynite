import { exec, execSync } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import {
  AYNITE_SUBDIRS,
  copy,
  exists,
  getAyniteDir,
  joinPaths,
  readdir,
  readJson,
  remove,
} from '../../lib/path'
import type { ShellConfig } from '../../lib/types/system'

export type { ShellConfig }

const execAsync = promisify(exec)

/**
 * Resolves the best available shell on the current platform.
 *
 * On Windows, priority order is:
 *   1. pwsh.exe (PowerShell Core 7+) — cross-platform, modern
 *   2. powershell.exe (Windows PowerShell 5.1) — built-in
 *   3. ComSpec / cmd.exe — ultimate fallback
 *
 * On Unix, respects the SHELL env var or falls back to /bin/zsh (macOS) / /bin/bash (Linux).
 *
 * Returns a ShellConfig with the shell path, appropriate CLI args for
 * running a command, and metadata flags.
 *
 * For spawn() usage: spawn(config.shell, [...config.args, command])
 * For exec() usage:  set options.shell = config.shell so exec sends
 *                    the command as-is to the target shell. The args
 *                    fields describe how the shell is invoked so both
 *                    spawn and exec paths produce the same result.
 */
export function getShellConfig(): ShellConfig {
  if (process.platform === 'win32') {
    // Try pwsh.exe first (modern PowerShell Core), then powershell.exe, then cmd.exe
    const pwsh = tryResolveExe('pwsh.exe')
    if (pwsh) {
      return {
        shell: pwsh,
        args: ['-NoProfile', '-Command'],
        isWindows: true,
        isPowershell: true,
      }
    }
    const powershell = tryResolveExe('powershell.exe')
    if (powershell) {
      return {
        shell: powershell,
        args: ['-NoProfile', '-Command'],
        isWindows: true,
        isPowershell: true,
      }
    }
    const cmd = process.env.ComSpec || 'cmd.exe'
    return {
      shell: cmd,
      args: ['/d', '/c'],
      isWindows: true,
      isPowershell: false,
    }
  }

  const shell =
    process.env.SHELL ||
    (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
  return { shell, args: ['-l', '-c'], isWindows: false, isPowershell: false }
}

/**
 * Try to resolve an executable by name using WHERE (Windows) or which (Unix).
 * Returns the full path if found, or null otherwise.
 */
function tryResolveExe(exe: string): string | null {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`where ${exe}`, { stdio: 'pipe', timeout: 2000 })
        .toString()
        .trim()
        .split('\n')[0]
        .split('\r')[0]
        .trim()
      return result || null
    }
    const result = execSync(`which ${exe}`, { stdio: 'pipe', timeout: 2000 })
      .toString()
      .trim()
    return result || null
  } catch {
    return null
  }
}

/**
 * Escapes a string for safe inclusion in single-quoted shell string.
 * This handles the Unix case where we wrap in `shell -l -c '...'`.
 */
function escapeForUnixShell(command: string): string {
  // End single-quote, add escaped quote, resume single-quote: '\''
  return command.replace(/'/g, "'\\''")
}

/**
 * Runs a shell command through the user's default login shell.
 * On Unix, this sources the user's profile files (.zprofile, .bash_profile, etc.)
 * so that tools installed via Homebrew, nvm, etc. are available on the PATH.
 * On Windows, prefers PowerShell (pwsh > powershell > cmd.exe).
 *
 * For Unix: constructs `shell -l -c 'escaped_command'` and runs it through
 *           /bin/sh (the Node default). This ensures profile files are sourced
 *           and the login shell environment is available.
 * For Windows cmd.exe: sets shell option to cmd.exe so Node handles /d /s /c.
 * For Windows PowerShell: constructs the full command string since we need
 *           -NoProfile -Command flags passed explicitly.
 */
export async function execInUserShell(
  command: string,
  options: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<{ stdout: string; stderr: string }> {
  const config = getShellConfig()

  // ── Windows ────────────────────────────────────────────────────────────
  if (config.isWindows) {
    if (config.isPowershell) {
      // PowerShell: construct full command to include -NoProfile -Command.
      // exec() uses cmd.exe by default on Windows, which correctly launches
      // the PowerShell process from the constructed command string.
      const fullCommand = `"${config.shell}" ${config.args.join(' ')} "${command}"`
      return await execAsync(fullCommand, {
        ...options,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120_000,
      })
    }

    // cmd.exe: set shell so Node handles /d /s /c wrapping
    return await execAsync(command, {
      ...options,
      shell: config.shell,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
    })
  }

  // ── Unix (macOS / Linux) ──────────────────────────────────────────────
  // Construct the full command ourselves so we can pass -l (login shell)
  // which sources profile files. Node's exec shell option doesn't support -l.
  const escapedCommand = escapeForUnixShell(command)
  const fullCommand = `${config.shell} ${config.args.join(' ')} '${escapedCommand}'`
  return await execAsync(fullCommand, {
    ...options,
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
  })
}

export async function getSystemFonts(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      'fc-list :lang=en --format="%{family}\n"',
      { timeout: 5000 },
    )
    return [
      ...new Set(
        stdout
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
      ),
    ].sort()
  } catch {
    return [
      'Inter',
      'Arial',
      'Helvetica',
      'Times New Roman',
      'Courier New',
      'Georgia',
      'Verdana',
    ]
  }
}

/**
 * Returns the path to the bundled dist-views directory.
 * In dev (unpackaged): <project_root>/resources/dist-views
 * In production (packaged): <resourcesPath>/dist-views
 */
function getBundledViewsDir(): string {
  const base = app.isPackaged
    ? process.resourcesPath
    : joinPaths(process.cwd(), 'resources')
  return joinPaths(base, 'dist-views')
}

/**
 * Compare two version strings (e.g. "0.1.5" and "0.2.0").
 * Returns true if versionA < versionB.
 * Handles semver-like strings with numeric dot-separated parts.
 */
function isVersionLowerThan(versionA: string, versionB: string): boolean {
  const aParts = versionA.split(/[.-]/).map(Number)
  const bParts = versionB.split(/[.-]/).map(Number)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] ?? (i >= 3 ? -1 : 0)
    const bVal = bParts[i] ?? (i >= 3 ? -1 : 0)
    if (aVal !== bVal) return aVal < bVal
  }
  return false
}

/**
 * Replace a view in the runtime views directory with the bundled version.
 * This ensures outdated views (those with an older `aynite-version`) get
 * updated HTML/assets and config.json from the app bundle.
 */
async function restoreViewFromBundle(viewName: string): Promise<boolean> {
  const runtimeViewDir = joinPaths(
    getAyniteDir(),
    AYNITE_SUBDIRS.VIEWS,
    viewName,
  )
  const bundledViewDir = joinPaths(getBundledViewsDir(), 'views', viewName)

  if (!(await exists(bundledViewDir))) return false

  try {
    // Remove the runtime view directory entirely, then copy the bundled one
    await remove(runtimeViewDir, { recursive: true, force: true })
    await copy(bundledViewDir, runtimeViewDir, { recursive: true })
    return true
  } catch (e) {
    console.error(
      `[Views] Failed to restore view "${viewName}" from bundle:`,
      e,
    )
    return false
  }
}

/**
 * Check a view's config.json for `aynite-version` and determine if it should
 * be loaded or replaced with the bundled version.
 *
 * Returns true if the view is valid and should be included, false if it should
 * be skipped (no aynite-version) or has been restored from bundle.
 */
async function validateAndMaybeRestoreView(viewName: string): Promise<boolean> {
  const configPath = joinPaths(
    getAyniteDir(),
    AYNITE_SUBDIRS.VIEWS,
    viewName,
    'config.json',
  )

  if (!(await exists(configPath))) {
    // Views without a config.json are skipped (likely user-created or incomplete)
    return false
  }

  const config = await readJson<Record<string, unknown>>(configPath, {})

  // No aynite-version → skip this view entirely (it's not managed by the app)
  const ayniteVersion = config?.['aynite-version']
  if (!ayniteVersion || typeof ayniteVersion !== 'string') {
    return false
  }

  const appVersion = app.getVersion()

  // If the view's version is lower than the app version, restore from bundle
  if (isVersionLowerThan(ayniteVersion, appVersion)) {
    console.log(
      `[Views] View "${viewName}" version ${ayniteVersion} < app ${appVersion}, restoring from bundle`,
    )
    return await restoreViewFromBundle(viewName)
  }

  return true
}

export async function getAvailableViews(): Promise<
  { id: string; name: string }[]
> {
  const viewsDir = joinPaths(getAyniteDir(), AYNITE_SUBDIRS.VIEWS)
  if (!(await exists(viewsDir))) return []

  const entries = await readdir(viewsDir)
  const views: { id: string; name: string }[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const indexPath = joinPaths(viewsDir, entry.name, 'index.html')
      if (!(await exists(indexPath))) continue

      // Validate version and potentially restore from bundle
      const valid = await validateAndMaybeRestoreView(entry.name)
      if (!valid) continue

      // Simple name transformation: aichat -> AI Chat
      const name = entry.name
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace('Aichat', 'AI Chat')
        .replace('Treeview', 'File Explorer')

      views.push({
        id: entry.name,
        name,
      })
    }
  }
  return views
}

export {
  isVersionLowerThan,
  restoreViewFromBundle,
  validateAndMaybeRestoreView,
}
