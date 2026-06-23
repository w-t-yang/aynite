import { ipcMain } from 'electron'
import { FlowChannels } from '../../lib/constants/ipc-channels'
import {
  ensureDir,
  exists,
  getFlowDefinitionPath,
  getFlowDir,
  getFlowExecutionsDir,
  getFlowsDir,
  readdir,
  readJson,
  writeJson,
} from '../../lib/path'
import type { FlowDefinition } from '../../lib/types/flows'

export async function listFlows(): Promise<FlowDefinition[]> {
  const flowsDir = getFlowsDir()
  if (!(await exists(flowsDir))) return []

  const entries = await readdir(flowsDir)
  const flows: FlowDefinition[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const defPath = getFlowDefinitionPath(entry.name)
    if (await exists(defPath)) {
      const def = await readJson<FlowDefinition>(defPath)
      flows.push(def)
    }
  }

  // Sort by createdAt descending (newest first)
  flows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return flows
}

export async function createFlow(): Promise<FlowDefinition> {
  const flowsDir = getFlowsDir()
  await ensureDir(flowsDir)

  // Find the next available flow number
  const existing = await listFlows()
  let maxNum = 0
  for (const flow of existing) {
    const match = flow.id.match(/^flow-(\d+)$/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }
  const nextNum = maxNum + 1

  const flowId = `flow-${nextNum}`
  const flowDir = getFlowDir(flowId)
  await ensureDir(flowDir)

  // Create executions directory
  await ensureDir(getFlowExecutionsDir(flowId))

  const now = new Date().toISOString()
  const definition: FlowDefinition = {
    id: flowId,
    name: `Flow ${nextNum}`,
    description: '',
    createdAt: now,
    steps: [],
  }

  const defPath = getFlowDefinitionPath(flowId)
  await writeJson(defPath, definition)

  return definition
}

export async function updateFlow(
  flowId: string,
  updates: Partial<FlowDefinition>,
): Promise<FlowDefinition> {
  const defPath = getFlowDefinitionPath(flowId)
  const current = await readJson<FlowDefinition>(defPath)
  const updated = { ...current, ...updates, id: flowId }
  await writeJson(defPath, updated)
  return updated
}

export function setupFlowIpc() {
  ipcMain.handle(FlowChannels.LIST, async () => {
    return await listFlows()
  })

  ipcMain.handle(FlowChannels.CREATE, async () => {
    return await createFlow()
  })

  ipcMain.handle(
    FlowChannels.UPDATE,
    async (_event, flowId: string, updates: Partial<FlowDefinition>) => {
      return await updateFlow(flowId, updates)
    },
  )
}
