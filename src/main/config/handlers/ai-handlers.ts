/**
 * Handlers for AI/session config keys (AI provider, agents, prompts).
 *
 * Agents are stored as individual JSON files in ~/.aynite/agents/<id>.json.
 * The config.json only holds the defaultAgentId (fallback when workspace
 * state does not specify an active agent).
 */

import type { MainConfig } from '../../../lib/constants/types'
import {
  ensureDir,
  getAgentPath,
  getAgentsDir,
  getAIConfigPath,
  getMainConfigPath,
  readdir,
  readJson,
  writeJson,
} from '../../../lib/path'
import type { Agent } from '../../../lib/types/ai'
import { trackEvent } from '../../telemetry/index'
import { getWindowWorkspace } from '../../window-state'
import {
  getWorkspaceState,
  getWorkspacesList,
  saveWorkspaceState,
} from '../../workspace'
import type { ConfigHandler } from '../handler-registry'
import { loadConfig } from '../logic'

/**
 * Read all agent files from ~/.aynite/agents/ directory.
 * Returns an array of Agent objects.
 */
async function readAllAgents(): Promise<Agent[]> {
  const agentsDir = getAgentsDir()
  await ensureDir(agentsDir).catch(() => {})
  const entries = await readdir(agentsDir).catch(() => [])
  const agents: Agent[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const agentId = entry.name.replace(/\.json$/, '')
    const agentPath = getAgentPath(agentId)
    const agent = await readJson<Agent>(agentPath).catch(() => null)
    if (agent?.id) {
      agents.push(agent)
    }
  }

  return agents.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Save an agent to its individual file in ~/.aynite/agents/.
 */
async function saveAgent(agent: Agent): Promise<void> {
  const agentsDir = getAgentsDir()
  await ensureDir(agentsDir)
  const agentPath = getAgentPath(agent.id)
  await writeJson(agentPath, agent)
}

/**
 * Delete an agent file from ~/.aynite/agents/.
 */
async function deleteAgentFile(agentId: string): Promise<void> {
  const { unlink } = await import('node:fs/promises')
  const agentPath = getAgentPath(agentId)
  await unlink(agentPath).catch(() => {})
}

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

        const agentList = await readAllAgents()

        // Use workspace state if explicitly set (i.e., the user has switched
        // agents in this workspace). Otherwise fall back to config.json's
        // defaultAgentId, which may differ from the old hardcoded 'aynite'.
        let activeId = workspaceState.activeAgentId
        if (
          activeId === 'aynite' &&
          mainConfig.defaultAgentId &&
          mainConfig.defaultAgentId !== 'aynite'
        ) {
          // Workspace still has the old hardcoded default: use config.json's
          // global default instead. Also auto-heal the workspace config on
          // disk so subsequent reads don't need this fallback logic.
          activeId = mainConfig.defaultAgentId
          saveWorkspaceState(workspaceName, {
            activeAgentId: activeId,
          }).catch(() => {})
        }

        if (!activeId) {
          activeId = mainConfig.defaultAgentId || 'aynite'
        }

        return { activeId, list: agentList }
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
        if (payload?.activeId || payload?.providers) {
          const existingAny = existing as any
          const payloadProviders = Array.isArray(payload?.providers)
            ? payload.providers
            : []
          const existingProviders = Array.isArray(existingAny?.providers)
            ? existingAny.providers
            : []
          const providerCount =
            payloadProviders.length || existingProviders.length || 0
          trackEvent('ai_provider_configured', {
            provider_count: providerCount,
            has_active: payload?.activeId ? 1 : 0,
          })
        }
        return true
      }
      case 'agents': {
        // Update workspace state with active agent
        if (payload?.activeId) {
          const workspaceName =
            winId && winId > 0
              ? await getWindowWorkspace(winId)
              : (await getWorkspacesList()).active
          await saveWorkspaceState(workspaceName, {
            activeAgentId: payload.activeId,
          })
        }

        // Update defaultAgentId in config.json
        const mainConfig: MainConfig =
          (await readJson<MainConfig>(getMainConfigPath())) || {}
        if (payload?.activeId) {
          mainConfig.defaultAgentId = payload.activeId
        }
        delete mainConfig.agents
        await writeJson(getMainConfigPath(), mainConfig)

        // Save individual agent files when a full list is provided
        if (payload?.list && Array.isArray(payload.list)) {
          await ensureDir(getAgentsDir())
          for (const agent of payload.list) {
            if (agent.id) {
              await saveAgent({
                id: agent.id,
                name: agent.name || agent.id,
                icon: agent.icon,
                promptFiles: agent.promptFiles || [],
                introduction: agent.introduction,
                tools: agent.tools,
              })
            }
          }

          // Remove agent files that are no longer in the list
          const savedIds = new Set(payload.list.map((a: any) => a.id))
          const allFiles = await readdir(getAgentsDir()).catch(() => [])
          for (const file of allFiles) {
            if (!file.isFile() || !file.name.endsWith('.json')) continue
            const fileId = file.name.replace(/\.json$/, '')
            if (!savedIds.has(fileId)) {
              await deleteAgentFile(fileId)
            }
          }
        }

        return true
      }
      default:
        return false
    }
  },
}))()
