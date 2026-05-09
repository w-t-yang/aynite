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
