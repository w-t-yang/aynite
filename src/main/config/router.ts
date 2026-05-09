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
import type { MainConfig, WorkspaceConfig } from '../../lib/constants/types'
import {
  getAIConfigPath,
  getKeybindingsConfigPath,
  getMainConfigPath,
  getWorkspaceDataPath,
  readJson,
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
      return await listSessions()
    }

    case ConfigKey.LOAD_CHAT_LOG: {
      if (payload?.id && payload.date) {
        return await loadSession(payload.id, payload.date)
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
      const config = await loadConfig()
      return config.agents || { activeId: 'aynite', list: [] }
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
      const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
      return mainConfig.activeSessionId || null
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
        await saveSession(payload.id, payload.messages)
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

    case ConfigKey.AGENTS:
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
      const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
      mainConfig.activeSessionId = payload
      await writeJson(getMainConfigPath(), mainConfig)
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
      await deleteSession(id)
      sendAppEvent(AppEvents.SESSION_DELETED, { id })
      return true
    }

    default:
      console.warn(`[ConfigRouter] Unknown setConfig key: ${key}`)
      return false
  }
}
