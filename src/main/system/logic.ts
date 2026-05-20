import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import {
  AYNITE_SUBDIRS,
  exists,
  getAyniteDir,
  joinPaths,
  readdir,
} from '../../lib/path'

const execAsync = promisify(exec)

/**
 * Detects the user's default shell and returns the path to it.
 * Falls back to /bin/zsh on macOS, /bin/bash on Linux, and cmd.exe on Windows.
 */
function getUserShell(): string {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'cmd.exe'
  }
  return (
    process.env.SHELL ||
    (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
  )
}

/**
 * Runs a shell command through the user's default login shell.
 * On Unix, this sources the user's profile files (.zprofile, .bash_profile, etc.)
 * so that tools installed via Homebrew, nvm, etc. are available on the PATH.
 * On Windows, this simply uses execAsync as-is.
 */
export async function execInUserShell(
  command: string,
  options: { cwd?: string; env?: Record<string, string | undefined> } = {},
): Promise<{ stdout: string; stderr: string }> {
  if (process.platform === 'win32') {
    return await execAsync(command, options)
  }

  const shell = getUserShell()
  // Wrap command in single quotes to prevent the outer /bin/sh from expanding it.
  // Handle any single quotes inside the command using the standard shell escape:
  // end single-quote, add escaped quote, resume single-quote: '\''
  const escapedCommand = command.replace(/'/g, "'\\''")
  const fullCommand = `${shell} -l -c '${escapedCommand}'`
  return await execAsync(fullCommand, options)
}

export async function getSystemFonts(): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      'fc-list :lang=en --format="%{family}\n"',
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
      if (await exists(indexPath)) {
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
  }
  return views
}
