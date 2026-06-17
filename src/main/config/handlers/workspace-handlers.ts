/**
 * Handlers for workspace config keys (multi-workspace CRUD).
 */
import type { WorkspaceConfig } from '../../../lib/constants/types'
import { getWorkspaceDataPath, readJson, writeJson } from '../../../lib/path'
import { getWindowWorkspace, setWindowWorkspace } from '../../window-state'
import {
  getWorkspaceState,
  getWorkspacesList,
  switchWorkspace,
} from '../../workspace'
import type { ConfigHandler } from '../handler-registry'

export const workspaceHandlers: ConfigHandler = (() => ({
  get: async (key: string, _payload: any, winId?: number) => {
    switch (key) {
      case 'workspaces': {
        const wsConfig = await getWorkspacesList()
        const configs: WorkspaceConfig[] = []
        for (const wsName of wsConfig.list) {
          const state = await getWorkspaceState(wsName)
          configs.push(state)
        }
        return configs
      }
      case 'activeWorkspace': {
        if (winId && winId > 0) {
          return await getWindowWorkspace(winId)
        }
        const wsConfig = await getWorkspacesList()
        return wsConfig.active
      }
      default:
        return null
    }
  },
  set: async (key: string, payload: any, winId?: number) => {
    switch (key) {
      case 'activeWorkspace': {
        const id = payload as string
        await switchWorkspace(id)
        if (winId && winId > 0) {
          setWindowWorkspace(winId, id)
        }
        return true
      }
      case 'workspace': {
        const { id, config } = payload as {
          id: string
          config: WorkspaceConfig
        }
        const dataPath = getWorkspaceDataPath(id)
        const existing = await readJson<Record<string, unknown>>(dataPath, {})
        // Preserve activeSessionIdForBot if the incoming config doesn't have it.
        // The renderer doesn't track this field (it's messenger-only), so without
        // this guard, any renderer-side workspace config save would erase it.
        const updated = {
          ...existing,
          ...config,
          id,
          activeSessionIdForBot:
            config.activeSessionIdForBot ??
            existing.activeSessionIdForBot ??
            null,
        }
        await writeJson(dataPath, updated)
        return true
      }
      default:
        return false
    }
  },
}))()
