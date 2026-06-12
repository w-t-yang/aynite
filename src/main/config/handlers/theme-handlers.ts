/**
 * Handlers for theme-related config keys.
 */
import type { MainConfig } from '../../../lib/constants/types'
import { getMainConfigPath, readJson, writeJson } from '../../../lib/path'
import { deleteTheme, getTheme, getThemesList, saveTheme } from '../../theme'
import type { ConfigHandler } from '../handler-registry'

export const themeHandlers: ConfigHandler = (() => ({
  get: async (key: string, payload: any) => {
    switch (key) {
      case 'themes':
        return await getThemesList()
      case 'theme': {
        const themeId = payload as string
        return await getTheme(themeId || 'light')
      }
      case 'activeTheme': {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        return mainConfig.activeTheme || 'light'
      }
      default:
        return null
    }
  },
  set: async (key: string, payload: any) => {
    switch (key) {
      case 'activeTheme': {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        mainConfig.activeTheme = payload
        await writeJson(getMainConfigPath(), mainConfig)
        return true
      }
      case 'theme': {
        const { id, theme } = payload as {
          id: string
          theme: Record<string, unknown>
        }
        await saveTheme(id, theme)
        return true
      }
      case 'theme-delete':
        return await deleteTheme(payload as string)
      default:
        return false
    }
  },
}))()
