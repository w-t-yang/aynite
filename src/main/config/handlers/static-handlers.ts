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
import type { ConfigHandler } from '../handler-registry'
import { validateAgainstSchema } from '../schema-validator'

export const staticHandlers: ConfigHandler = (() => ({
  get: async (key: string, payload: any) => {
    switch (key) {
      case 'version':
        return app.getVersion()
      case 'playbook-path':
        return getPlaybookPath()
      case 'view-config': {
        const viewName = payload?.view as string
        if (!viewName) return null
        return await readJson(getViewConfigPath(viewName), null)
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
