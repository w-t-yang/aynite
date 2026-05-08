import type { WorkspaceConfig } from '../../lib/constants/types'
import {
  DEFAULT_WORKSPACE_CONFIG,
  DEFAULT_WORKSPACE_ID,
} from '../../lib/constants/workspace'
import {
  getPathSep,
  getWorkspaceDataPath,
  getWorkspacesConfigPath,
  getWorkspacesDir,
  joinPaths,
  readdir,
  readJson,
  writeJson,
} from '../../lib/path'
import type { WorkspacesConfig } from '../../lib/types/workspace'

async function getWorkspacesConfig(): Promise<WorkspacesConfig> {
  const configPath = getWorkspacesConfigPath()
  return await readJson<WorkspacesConfig>(configPath, {
    active: DEFAULT_WORKSPACE_ID,
    list: [DEFAULT_WORKSPACE_ID],
  })
}

async function saveWorkspacesConfig(config: WorkspacesConfig): Promise<void> {
  const configPath = getWorkspacesConfigPath()
  await writeJson(configPath, config)
}

async function getWorkspaceData(name: string): Promise<WorkspaceConfig> {
  const workspacePath = getWorkspaceDataPath(name)
  return await readJson<WorkspaceConfig>(workspacePath, {
    ...DEFAULT_WORKSPACE_CONFIG,
    id: name,
  })
}

export async function getWorkspacesList(): Promise<WorkspacesConfig> {
  return await getWorkspacesConfig()
}

export async function createWorkspace(name: string): Promise<WorkspacesConfig> {
  const wsConfig = await getWorkspacesConfig()
  if (wsConfig.list.includes(name)) throw new Error('Workspace already exists')

  wsConfig.list.push(name)
  wsConfig.active = name

  const newWorkspacePath = getWorkspaceDataPath(name)
  await writeJson(newWorkspacePath, { ...DEFAULT_WORKSPACE_CONFIG, id: name })
  await saveWorkspacesConfig(wsConfig)
  return wsConfig
}

export async function switchWorkspace(name: string): Promise<WorkspacesConfig> {
  const wsConfig = await getWorkspacesConfig()
  if (!wsConfig.list.includes(name)) throw new Error('Workspace not found')
  wsConfig.active = name
  await saveWorkspacesConfig(wsConfig)
  return wsConfig
}

export async function saveWorkspaceState(
  workspaceName: string,
  state: Partial<WorkspaceConfig>,
): Promise<void> {
  const workspacePath = getWorkspaceDataPath(workspaceName)
  const current = await getWorkspaceData(workspaceName)
  const updated = { ...current, ...state }
  await writeJson(workspacePath, updated)
}

async function resolveWorkspace(workspaceName?: string) {
  const wsConfig = await getWorkspacesConfig()
  const targetWs = workspaceName || wsConfig.active
  const data = await getWorkspaceData(targetWs)
  return { targetWs, data }
}

export async function addWorkspaceFolder(
  folderPath: string,
  workspaceName?: string,
): Promise<boolean> {
  const { targetWs, data } = await resolveWorkspace(workspaceName)

  // Normalize paths for comparison (ensure trailing slash consistency)
  const sep = getPathSep()
  const normalize = (p: string) => (p.endsWith(sep) ? p : p + sep)
  const newPath = normalize(folderPath)

  for (const existing of data.folders) {
    const existingPath = normalize(existing)

    // Check if newPath is a parent of existingPath or vice versa
    if (existingPath.startsWith(newPath)) {
      throw new Error(
        `Cannot add folder: "${folderPath}" is a parent of the already added folder "${existing}".`,
      )
    }
    if (newPath.startsWith(existingPath)) {
      throw new Error(
        `Cannot add folder: "${folderPath}" is already contained within "${existing}".`,
      )
    }
  }

  if (!data.folders.includes(folderPath)) {
    data.folders.push(folderPath)
    await writeJson(getWorkspaceDataPath(targetWs), data)
  }
  return true
}

export async function removeWorkspaceFolder(
  folderPath: string,
  workspaceName?: string,
): Promise<boolean> {
  const { targetWs, data } = await resolveWorkspace(workspaceName)
  data.folders = data.folders.filter((f: string) => f !== folderPath)
  await writeJson(getWorkspaceDataPath(targetWs), data)
  return true
}

export async function reorderWorkspaceFolders(
  folders: string[],
  workspaceName?: string,
): Promise<boolean> {
  const { targetWs, data } = await resolveWorkspace(workspaceName)
  data.folders = folders
  await writeJson(getWorkspaceDataPath(targetWs), data)
  return true
}

export async function getWorkspaceFolders(
  workspaceName?: string,
): Promise<string[]> {
  const { data } = await resolveWorkspace(workspaceName)
  return data.folders || []
}

export async function getWorkspaceState(
  workspaceName?: string,
): Promise<WorkspaceConfig> {
  const wsConfig = await getWorkspacesConfig()
  const targetWs = workspaceName || wsConfig.active
  return await getWorkspaceData(targetWs)
}

export async function renameWorkspaceFolder(oldPath: string, newPath: string) {
  const workspacesDir = getWorkspacesDir()
  try {
    const files = await readdir(workspacesDir)
    for (const file of files) {
      if (file.isDirectory()) {
        const wsPath = joinPaths(workspacesDir, file.name, 'config.json')
        try {
          const data = await readJson<WorkspaceConfig>(wsPath)
          let modified = false

          if (data.folders) {
            data.folders = data.folders.map((f: string) => {
              if (f === oldPath) {
                modified = true
                return newPath
              }
              if (f.startsWith(oldPath + getPathSep())) {
                modified = true
                return newPath + f.substring(oldPath.length)
              }
              return f
            })
          }

          if (modified) {
            await writeJson(wsPath, data)
          }
        } catch (_err) {
          // Skip if no config.json found or invalid
        }
      }
    }
  } catch (e) {
    console.error('Error renaming workspace folders:', e)
  }
}
