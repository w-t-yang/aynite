/**
 * Config Router
 *
 * Maps ConfigKey-based getConfig/setConfig calls from the renderer
 * to the correct backend logic across modules.
 */
import { app } from 'electron'
import { DEFAULT_AI_TOOLS } from '../../lib/constants/ai'
import { AppEvents } from '../../lib/constants/app'
import { ConfigKey } from '../../lib/constants/config'
import { AYNITE_SUBDIRS } from '../../lib/constants/path'
import type { MainConfig, WorkspaceConfig } from '../../lib/constants/types'
import {
  exists,
  getAIConfigPath,
  getAynitePath,
  getKeybindingsConfigPath,
  getMainConfigPath,
  getPlaybookPath,
  getViewConfigPath,
  getWorkspaceDataPath,
  readdir,
  readJson,
  readText,
  writeJson,
} from '../../lib/path'
import {
  deleteSession,
  getMergedSystemPrompt,
  getToolsMetadata,
  listSessions,
  loadSession,
  saveSession,
} from '../ai'
import { deleteTheme, getTheme, getThemesList, saveTheme } from '../theme'
import { sendAppEvent } from '../window'
import {
  getWorkspaceState,
  getWorkspacesList,
  saveWorkspaceState,
  switchWorkspace,
  updateTileData,
} from '../workspace'
import { loadConfig } from './logic'

// ─── Schema validation helper (main-process compatible) ─────────────────

function checkSchemaType(data: unknown, expected: string): boolean {
  switch (expected) {
    case 'string':
      return typeof data === 'string'
    case 'number':
      return typeof data === 'number' && !Number.isNaN(data)
    case 'integer':
      return Number.isInteger(data)
    case 'boolean':
      return typeof data === 'boolean'
    case 'object':
      return typeof data === 'object' && data !== null && !Array.isArray(data)
    case 'array':
      return Array.isArray(data)
    default:
      return true
  }
}

function validateAgainstSchema(data: unknown, schema: any): boolean {
  if (!schema || typeof schema !== 'object') return true

  // anyOf
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some((alt: any) => validateAgainstSchema(data, alt))
  }

  // type check
  if (schema.type !== undefined) {
    if (!checkSchemaType(data, schema.type)) return false
  }

  // enum check
  if (Array.isArray(schema.enum)) {
    return schema.enum.includes(data)
  }

  // object checks
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>

    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in obj)) return false
      }
    }

    // properties
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          if (!validateAgainstSchema(obj[key], propSchema)) return false
        }
      }
    }

    // patternProperties
    if (
      schema.patternProperties &&
      typeof schema.patternProperties === 'object'
    ) {
      for (const [patternStr, propSchema] of Object.entries(
        schema.patternProperties,
      )) {
        const regex = new RegExp(patternStr)
        for (const key of Object.keys(obj)) {
          if (regex.test(key)) {
            if (!validateAgainstSchema(obj[key], propSchema)) return false
          }
        }
      }
    }
  }

  // array checks
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems)
      return false
    if (schema.items) {
      for (const item of data) {
        if (!validateAgainstSchema(item, schema.items)) return false
      }
    }
  }

  return true
}

/**
 * getConfig — route a ConfigKey to the appropriate data source.
 */
export async function routeGetConfig(key: string, payload?: any): Promise<any> {
  switch (key) {
    case ConfigKey.WORKSPACES: {
      const wsConfig = await getWorkspacesList()
      const configs: WorkspaceConfig[] = []
      for (const wsName of wsConfig.list) {
        const state = await getWorkspaceState(wsName)
        configs.push(state)
      }
      return configs
    }

    case ConfigKey.ACTIVE_WORKSPACE: {
      const wsConfig = await getWorkspacesList()
      return wsConfig.active
    }

    case ConfigKey.KEYBINDINGS: {
      const config = await loadConfig()
      return config.keybindings
    }

    case ConfigKey.VIEWS: {
      const config = await loadConfig()
      return (config as MainConfig).views || []
    }

    case ConfigKey.THEMES: {
      return await getThemesList()
    }

    case ConfigKey.THEME: {
      const themeId = payload as string
      return await getTheme(themeId || 'light')
    }

    case ConfigKey.ACTIVE_THEME: {
      const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
      return mainConfig.activeTheme || 'light'
    }

    case ConfigKey.CHAT_LOGS: {
      const wsConfig = await getWorkspacesList()
      return await listSessions(wsConfig.active)
    }

    case ConfigKey.LOAD_CHAT_LOG: {
      if (payload?.id && payload.date) {
        const wsConfig = await getWorkspacesList()
        return await loadSession(wsConfig.active, payload.id, payload.date)
      }
      return null
    }

    case ConfigKey.MERGED_SYSTEM_PROMPT: {
      return await getMergedSystemPrompt(
        payload?.globalFiles,
        payload?.agentFiles,
      )
    }

    case ConfigKey.AI: {
      const config = await loadConfig()
      return config.ai
    }

    case ConfigKey.AGENTS: {
      const mainConfig = await loadConfig()
      const wsConfig = await getWorkspacesList()
      const workspaceState = await getWorkspaceState(wsConfig.active)
      return {
        activeId:
          workspaceState.activeAgentId ||
          mainConfig.agents?.activeId ||
          'aynite',
        list: mainConfig.agents?.list || [],
      }
    }

    case ConfigKey.PROMPTS: {
      const config = await loadConfig()
      return config.prompts || { files: [] }
    }

    case ConfigKey.SKILLS: {
      const config = await loadConfig()
      return config.skills || { folders: [] }
    }

    case ConfigKey.COMMANDS: {
      const config = await loadConfig()
      return config.commands || { folders: [] }
    }

    case ConfigKey.TOOLS: {
      const list = await getToolsMetadata()
      const mainCfg = await readJson<MainConfig>(getMainConfigPath(), {})
      const active = mainCfg.aiTools || DEFAULT_AI_TOOLS
      return { active, list }
    }

    case ConfigKey.VERSION: {
      return app.getVersion()
    }
    case ConfigKey.ACTIVE_FILE: {
      const wsConfig = await getWorkspacesList()
      const state = await getWorkspaceState(wsConfig.active)
      return state.activeFile || null
    }
    case ConfigKey.OPENED_FILES: {
      const wsConfig = await getWorkspacesList()
      const state = await getWorkspaceState(wsConfig.active)
      return state.files || []
    }
    case ConfigKey.ACTIVE_SESSION_ID: {
      const wsConfig = await getWorkspacesList()
      const state = await getWorkspaceState(wsConfig.active)
      return state.activeSessionId || null
    }

    case ConfigKey.VIEW_CONFIG: {
      const viewName = payload?.view as string
      if (!viewName) return null
      return await readJson(getViewConfigPath(viewName), null)
    }

    case ConfigKey.PLAYBOOK_PATH: {
      return getPlaybookPath()
    }

    case ConfigKey.MATCHING_VIEWS: {
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
              config: { name: config.name, description: config.description },
            })
          }
        }

        return matches
      } catch {
        return []
      }
    }

    default:
      console.warn(`[ConfigRouter] Unknown getConfig key: ${key}`)
      return null
  }
}

/**
 * setConfig — route a ConfigKey to the appropriate data sink.
 */
export async function routeSetConfig(
  key: string,
  payload: any,
): Promise<boolean> {
  switch (key) {
    case ConfigKey.ACTIVE_WORKSPACE: {
      const id = payload as string
      await switchWorkspace(id)
      return true
    }

    case ConfigKey.WORKSPACE: {
      const { id, config } = payload as { id: string; config: WorkspaceConfig }
      const dataPath = getWorkspaceDataPath(id)

      // Defensive merge: load existing first if possible
      const existing = await readJson<Record<string, unknown>>(dataPath, {})
      const updated = { ...existing, ...config, id }

      await writeJson(dataPath, updated)

      return true
    }

    case ConfigKey.KEYBINDINGS: {
      await writeJson(getKeybindingsConfigPath(), payload)
      return true
    }

    case ConfigKey.ACTIVE_THEME: {
      const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
      mainConfig.activeTheme = payload
      await writeJson(getMainConfigPath(), mainConfig)
      return true
    }

    case ConfigKey.THEME: {
      const { id, theme } = payload as {
        id: string
        theme: Record<string, unknown>
      }
      await saveTheme(id, theme)
      return true
    }

    case ConfigKey.THEME_DELETE: {
      const id = payload as string
      return await deleteTheme(id)
    }

    case ConfigKey.SAVE_CHAT_LOG: {
      if (payload?.id && payload.messages) {
        const wsConfig = await getWorkspacesList()
        await saveSession(wsConfig.active, payload.id, payload.messages)
      }
      return true
    }

    case ConfigKey.AI: {
      const dataPath = getAIConfigPath()
      const existing = await readJson<Record<string, unknown>>(dataPath, {})
      await writeJson(dataPath, { ...existing, ...payload })
      return true
    }

    case ConfigKey.TOOLS: {
      // payload is { active: { [key: string]: boolean }, list: [...] }
      const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
      mainConfig.aiTools = payload.active
      await writeJson(getMainConfigPath(), mainConfig)
      return true
    }

    case ConfigKey.PROMPTS:
    case ConfigKey.SKILLS:
    case ConfigKey.COMMANDS: {
      // These are sub-keys of the main config
      const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
      const existing = (mainConfig[key] || {}) as Record<string, unknown>
      mainConfig[key] = { ...existing, ...payload }
      await writeJson(getMainConfigPath(), mainConfig)
      return true
    }
    case ConfigKey.AGENTS: {
      // Split: activeId -> workspace config, list -> global config
      if (payload?.activeId) {
        const wsConfig = await getWorkspacesList()
        await saveWorkspaceState(wsConfig.active, {
          activeAgentId: payload.activeId,
        })
      }
      if (payload?.list) {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        mainConfig.agents = {
          activeId: mainConfig.agents?.activeId || 'aynite',
          list: payload.list,
        }
        await writeJson(getMainConfigPath(), mainConfig)
      }
      return true
    }
    case ConfigKey.ACTIVE_FILE: {
      const path = payload as string
      const wsConfig = await getWorkspacesList()
      await saveWorkspaceState(wsConfig.active, { activeFile: path })
      return true
    }
    case ConfigKey.OPENED_FILES: {
      const files = payload as string[]
      const wsConfig = await getWorkspacesList()
      await saveWorkspaceState(wsConfig.active, { files })
      return true
    }
    case ConfigKey.ACTIVE_SESSION_ID: {
      const wsConfig = await getWorkspacesList()
      await saveWorkspaceState(wsConfig.active, { activeSessionId: payload })
      sendAppEvent(AppEvents.ACTIVE_SESSION_CHANGED, { id: payload })
      return true
    }
    case ConfigKey.TILE_DATA: {
      const { tileId, data } = payload as {
        tileId: string
        data: Record<string, any>
      }
      await updateTileData(tileId, data)
      return true
    }
    case ConfigKey.SESSION_DELETE: {
      const id = payload as string
      const wsConfig = await getWorkspacesList()
      await deleteSession(wsConfig.active, id)
      sendAppEvent(AppEvents.SESSION_DELETED, { id })
      return true
    }

    default:
      console.warn(`[ConfigRouter] Unknown setConfig key: ${key}`)
      return false
  }
}
