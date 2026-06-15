/**
 * Handlers for static/pure config keys (version, playbook path, view config, matching views).
 */
import { app } from 'electron'
import { AYNITE_SUBDIRS } from '../../../lib/constants/path'
import type { MainConfig } from '../../../lib/constants/types'
import {
  exists,
  getAynitePath,
  getMainConfigPath,
  getPlaybookPath,
  getViewConfigPath,
  readdir,
  readJson,
  readText,
  writeJson,
} from '../../../lib/path'
import { isVersionLowerThan, restoreViewFromBundle } from '../../system/logic'
import type { ConfigHandler } from '../handler-registry'
import { validateAgainstSchema } from '../schema-validator'

/**
 * Detect the user's preferred language from the Electron app locale.
 * Returns 'zh' if the locale starts with 'zh', otherwise 'en'.
 */
function detectSystemLanguage(): string {
  const locale = app.getLocale()
  return locale.startsWith('zh') ? 'zh' : 'en'
}

export const staticHandlers: ConfigHandler = (() => ({
  get: async (key: string, payload: any) => {
    switch (key) {
      case 'version':
        return app.getVersion()
      case 'playbook-path':
        return getPlaybookPath()
      case 'language': {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        return mainConfig.language || detectSystemLanguage()
      }
      case 'view-config': {
        const viewName = payload?.view as string
        if (!viewName) return null

        // Check and restore if outdated
        const configPath = getViewConfigPath(viewName)
        const config = await readJson<Record<string, unknown> | null>(
          configPath,
          null,
        )
        if (!config) return null

        const ayniteVersion = config?.['aynite-version']
        const appVersion = app.getVersion()

        if (!ayniteVersion || typeof ayniteVersion !== 'string') {
          return null
        }

        if (isVersionLowerThan(ayniteVersion, appVersion)) {
          console.log(
            `[Views] view-config: view "${viewName}" version ${ayniteVersion} < app ${appVersion}, restoring from bundle`,
          )
          await restoreViewFromBundle(viewName)
          // Re-read after restore
          return await readJson(configPath, null)
        }

        return config
      }
      case 'matching-views': {
        const filePath = payload?.filePath as string
        if (!filePath) return []

        try {
          const raw = await readText(filePath)
          let fileData: unknown
          try {
            fileData = JSON.parse(raw)
          } catch {
            return []
          }

          const viewsDir = getAynitePath(AYNITE_SUBDIRS.VIEWS)
          if (!(await exists(viewsDir))) return []

          const entries = await readdir(viewsDir)
          const matches: Array<{ name: string; config: any }> = []

          for (const entry of entries) {
            if (!entry.isDirectory()) continue
            const configPath = getViewConfigPath(entry.name)
            if (!(await exists(configPath))) continue

            const config = await readJson<any>(configPath, null)
            if (!config) continue

            // Skip views without aynite-version (unmanaged)
            const ayniteVersion = config?.['aynite-version']
            if (!ayniteVersion || typeof ayniteVersion !== 'string') continue

            // Restore if outdated
            const appVersion = app.getVersion()
            if (isVersionLowerThan(ayniteVersion, appVersion)) {
              console.log(
                `[Views] matching-views: view "${entry.name}" version ${ayniteVersion} < app ${appVersion}, restoring from bundle`,
              )
              await restoreViewFromBundle(entry.name)
              // Re-read config after restore
              const restoredConfig = await readJson<any>(configPath, null)
              if (!restoredConfig) continue
              config.name = restoredConfig.name
              config.description = restoredConfig.description
              config.expected_file_type = restoredConfig.expected_file_type
            }

            if (!config?.expected_file_type?.schema) continue

            const ext = config.expected_file_type.ext
            if (ext && !filePath.toLowerCase().endsWith(`.${ext}`)) continue

            if (
              validateAgainstSchema(fileData, config.expected_file_type.schema)
            ) {
              matches.push({
                name: entry.name,
                config: {
                  name: config.name,
                  description: config.description,
                },
              })
            }
          }

          return matches
        } catch {
          return []
        }
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
      case 'language': {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        mainConfig.language = payload
        await writeJson(getMainConfigPath(), mainConfig)
        return true
      }
      case 'tools': {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        mainConfig.aiTools = payload.active
        await writeJson(getMainConfigPath(), mainConfig)
        return true
      }
      default:
        return false
    }
  },
}))()
