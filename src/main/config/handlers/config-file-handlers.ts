/**
 * Handlers for config-file-backed keys (keybindings, views, prompts, skills, commands, tools).
 */
import { DEFAULT_AI_TOOLS } from '../../../lib/constants/ai'
import type { MainConfig } from '../../../lib/constants/types'
import {
  getAIConfigPath,
  getKeybindingsConfigPath,
  getMainConfigPath,
  readJson,
  writeJson,
} from '../../../lib/path'
import { getToolsMetadata } from '../../ai'
import type { ConfigHandler } from '../handler-registry'
import { loadConfig } from '../logic'

export const configFileHandlers: ConfigHandler = (() => ({
  get: async (key: string) => {
    switch (key) {
      case 'keybindings': {
        const config = await loadConfig()
        return config.keybindings
      }
      case 'views': {
        const config = await loadConfig()
        return (config as MainConfig).views || []
      }
      case 'prompts': {
        const config = await loadConfig()
        return config.prompts || { files: [] }
      }
      case 'skills': {
        const config = await loadConfig()
        return config.skills || { folders: [] }
      }
      case 'commands': {
        const config = await loadConfig()
        return config.commands || { folders: [] }
      }
      case 'tools': {
        const list = getToolsMetadata()
        const mainCfg = await readJson<MainConfig>(getMainConfigPath(), {})
        const active = mainCfg.aiTools || DEFAULT_AI_TOOLS
        return { active, list }
      }
      default:
        return null
    }
  },
  set: async (key: string, payload: any) => {
    switch (key) {
      case 'keybindings': {
        await writeJson(getKeybindingsConfigPath(), payload)
        return true
      }
      case 'prompts':
      case 'skills':
      case 'commands': {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        const existing = (mainConfig[key] || {}) as Record<string, unknown>
        mainConfig[key] = { ...existing, ...payload }
        await writeJson(getMainConfigPath(), mainConfig)
        return true
      }
      case 'tools': {
        const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
        mainConfig.aiTools = payload.active
        await writeJson(getMainConfigPath(), mainConfig)
        return true
      }
      case 'ai': {
        const dataPath = getAIConfigPath()
        const existing = await readJson<Record<string, unknown>>(dataPath, {})
        await writeJson(dataPath, { ...existing, ...payload })
        return true
      }
      default:
        return false
    }
  },
}))()
