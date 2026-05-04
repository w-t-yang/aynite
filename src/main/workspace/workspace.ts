import { 
  getWorkspacesConfigPath,
  getWorkspaceDataPath,
  getWorkspacesDir,
  readJson, 
  writeJson,
  readdir,
  getPathSep,
  joinPaths,
  getAbsolutePath
} from '../../lib/path';
import { WorkspacesConfig, WorkspaceData, WorkspaceTab } from '../../lib/types/workspace';

async function getWorkspacesConfig(): Promise<WorkspacesConfig> {
  const configPath = getWorkspacesConfigPath();
  return await readJson<WorkspacesConfig>(configPath, { active: 'aynite-workspace', list: ['aynite-workspace'] });
}

async function saveWorkspacesConfig(config: WorkspacesConfig): Promise<void> {
  const configPath = getWorkspacesConfigPath();
  await writeJson(configPath, config);
}

export async function getWorkspacesList(): Promise<WorkspacesConfig> {
  return await getWorkspacesConfig();
}

export async function createWorkspace(name: string): Promise<WorkspacesConfig> {
  const wsConfig = await getWorkspacesConfig();
  if (wsConfig.list.includes(name)) throw new Error('Workspace already exists');

  wsConfig.list.push(name);
  wsConfig.active = name;

  const newWorkspacePath = getWorkspaceDataPath(name);
  await writeJson(newWorkspacePath, { folders: [], tabs: [], activeTabId: '' } as WorkspaceData);
  await saveWorkspacesConfig(wsConfig);
  return wsConfig;
}

export async function switchWorkspace(name: string): Promise<WorkspacesConfig> {
  const wsConfig = await getWorkspacesConfig();
  if (!wsConfig.list.includes(name)) throw new Error('Workspace not found');
  wsConfig.active = name;
  await saveWorkspacesConfig(wsConfig);
  return wsConfig;
}

export async function saveWorkspaceState(workspaceName: string, tabs: WorkspaceTab[], activeTabId: string): Promise<void> {
  const workspacePath = getWorkspaceDataPath(workspaceName);
  const data = await readJson<WorkspaceData>(workspacePath, { folders: [], tabs: [], activeTabId: '' });
  data.tabs = tabs;
  data.activeTabId = activeTabId;
  await writeJson(workspacePath, data);
}

export async function addWorkspaceFolder(folderPath: string, workspaceName?: string): Promise<void> {
  const wsConfig = await getWorkspacesConfig();
  const targetWs = workspaceName || wsConfig.active;
  const workspacePath = getWorkspaceDataPath(targetWs);
  const data = await readJson<WorkspaceData>(workspacePath, { folders: [], tabs: [], activeTabId: '' });
  if (!data.folders.includes(folderPath)) {
    data.folders.push(folderPath);
    await writeJson(workspacePath, data);
  }
}

export async function removeWorkspaceFolder(folderPath: string, workspaceName?: string): Promise<void> {
  const wsConfig = await getWorkspacesConfig();
  const targetWs = workspaceName || wsConfig.active;
  const workspacePath = getWorkspaceDataPath(targetWs);
  const data = await readJson<WorkspaceData>(workspacePath, { folders: [], tabs: [], activeTabId: '' });
  data.folders = data.folders.filter((f: string) => f !== folderPath);
  await writeJson(workspacePath, data);
}

export async function reorderWorkspaceFolders(folders: string[], workspaceName?: string): Promise<void> {
  const wsConfig = await getWorkspacesConfig();
  const targetWs = workspaceName || wsConfig.active;
  const workspacePath = getWorkspaceDataPath(targetWs);
  const data = await readJson<WorkspaceData>(workspacePath, { folders: [], tabs: [], activeTabId: '' });
  data.folders = folders;
  await writeJson(workspacePath, data);
}

export async function getWorkspaceFolders(workspaceName?: string): Promise<string[]> {
  const wsConfig = await getWorkspacesConfig();
  const targetWs = workspaceName || wsConfig.active;
  const workspacePath = getWorkspaceDataPath(targetWs);
  const data = await readJson<WorkspaceData>(workspacePath, { folders: [], tabs: [], activeTabId: '' });
  return data.folders;
}

export async function getWorkspaceState(workspaceName?: string): Promise<WorkspaceData> {
  const wsConfig = await getWorkspacesConfig();
  const targetWs = workspaceName || wsConfig.active;
  const workspacePath = getWorkspaceDataPath(targetWs);
  const data = await readJson<WorkspaceData>(workspacePath, { folders: [], tabs: [], activeTabId: '' });
  return { ...data, name: targetWs };
}

export async function renameWorkspaceFolder(oldPath: string, newPath: string) {
  const workspacesDir = getWorkspacesDir();
  try {
    const files = await readdir(workspacesDir);
    for (const file of files) {
      if (file.name.endsWith('.json')) {
        const wsPath = getAbsolutePath(file.name, workspacesDir);
        const data = await readJson<WorkspaceData>(wsPath);
        let modified = false;
        
        if (data.folders) {
          data.folders = data.folders.map((f: string) => {
            if (f === oldPath) {
              modified = true;
              return newPath;
            }
            if (f.startsWith(oldPath + getPathSep())) {
              modified = true;
              return newPath + f.substring(oldPath.length);
            }
            return f;
          });
        }
        
        if (modified) {
          await writeJson(wsPath, data);
        }
      }
    }
  } catch (e) {
    console.error('Error renaming workspace folders:', e);
  }
}
