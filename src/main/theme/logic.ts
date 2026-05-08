import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { DEFAULT_THEMES } from '../../lib/constants/themes'
import type { Theme } from '../../lib/constants/types'
import {
  ensureDir,
  exists,
  getBasename,
  getThemePath,
  getThemesDir,
  readdir,
  readJson,
  unlink,
  writeJson,
} from '../../lib/path'

const _execAsync = promisify(exec)

export async function initThemes() {
  const themesDir = getThemesDir()
  await ensureDir(themesDir)

  for (const [key, theme] of Object.entries(DEFAULT_THEMES)) {
    const themePath = getThemePath(key)
    if (!(await exists(themePath))) {
      await writeJson(themePath, theme)
    }
  }
}

export async function getThemesList(): Promise<Theme[]> {
  const themesDir = getThemesDir()
  const themes: Theme[] = []
  try {
    const files = (await readdir(themesDir)).filter((f) =>
      f.name.endsWith('.json'),
    )
    for (const file of files) {
      try {
        const theme = await readJson(
          getThemePath(getBasename(file.name, '.json')),
        )
        themes.push({ ...theme, id: getBasename(file.name, '.json') })
      } catch (e) {
        console.error(`Error reading theme ${file.name}`, e)
      }
    }
  } catch (e) {
    console.error('Error listing themes', e)
  }
  return themes
}

export async function getTheme(name: string): Promise<Theme> {
  const themePath = getThemePath(name)
  try {
    return await readJson(themePath)
  } catch {
    return DEFAULT_THEMES.light
  }
}

export async function saveTheme(name: string, data: any): Promise<boolean> {
  const themePath = getThemePath(name)
  await writeJson(themePath, data)
  return true
}

export async function restoreDefaultTheme(name: string): Promise<boolean> {
  if (!DEFAULT_THEMES[name]) return false
  const themePath = getThemePath(name)
  await writeJson(themePath, DEFAULT_THEMES[name])
  return true
}

export async function deleteTheme(name: string): Promise<boolean> {
  if (DEFAULT_THEMES[name]) return false
  const themePath = getThemePath(name)
  if (await exists(themePath)) {
    await unlink(themePath)
    return true
  }
  return false
}
