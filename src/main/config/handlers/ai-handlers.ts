/**
 * Handlers for AI/session config keys (AI provider, agents, prompts).
 */
import type { MainConfig } from '../../../lib/constants/types'
import {
  getAIConfigPath,
  getMainConfigPath,
  readJson,
  writeJson,
} from '../../../lib/path'
import { getWindowWorkspace } from '../../window-state'
import {
  getWorkspaceState,
  getWorkspacesList,
  saveWorkspaceState,
} from '../../workspace'
import type { ConfigHandler } from '../handler-registry'
import { loadConfig } from '../logic'

export const aiHandlers: ConfigHandler = (() => ({
  get: async (key: string, _payload: any, winId?: number) => {
    switch (key) {
      case 'ai': {
        const config = await loadConfig()
        return config.ai
      }
      case 'agents': {
        const mainConfig = await loadConfig()
        const workspaceName =
          winId && winId > 0
            ? await getWindowWorkspace(winId)
            : (await getWorkspacesList()).active
        const workspaceState = await getWorkspaceState(workspaceName)
        return {
          activeId:
            workspaceState.activeAgentId ||
            mainConfig.agents?.activeId ||
            'aynite',
          list: mainConfig.agents?.list || [],
        }
      }
      case 'prompts': {
        const config = await loadConfig()
        return config.prompts || { files: [] }
      }
      default:
        return null
    }
  },
  set: async (key: string, payload: any, winId?: number) => {
    switch (key) {
      case 'ai': {
        const dataPath = getAIConfigPath()
        const existing = await readJson<Record<string, unknown>>(dataPath, {})
        await writeJson(dataPath, { ...existing, ...payload })
        return true
      }
      case 'agents': {
        if (payload?.activeId) {
          const workspaceName =
            winId && winId > 0
              ? await getWindowWorkspace(winId)
              : (await getWorkspacesList()).active
          await saveWorkspaceState(workspaceName, {
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
      default:
        return false
    }
  },
}))()
