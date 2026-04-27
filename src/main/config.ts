import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

export function getConfigDir() {
  if (process.platform === 'win32') {
    return path.join(app.getPath('appData'), 'citron');
  } else {
    return path.join(os.homedir(), '.citron');
  }
}

export async function initAppFolders() {
  const baseDir = getConfigDir();
  
  const folders = ['config', 'skills', 'commands', 'workspaces'];
  for (const folder of folders) {
    const dir = path.join(baseDir, folder);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  const configDir = path.join(baseDir, 'config');
  const workspacesDir = path.join(baseDir, 'workspaces');

  // Default configs
  const defaults: Record<string, any> = {
    'appearance.json': { theme: 'dark' },
    'keybindings.json': { commandTab: 'META+X', chatTab: 'META+Y' },
    'ai.json': { 
      provider: 'gemini', 
      configs: { 
        gemini: { apiKey: '', url: '' },
        deepseek: { apiKey: '', url: '' },
        ollama: { apiKey: '', url: 'http://localhost:11434' }
      } 
    },
    'workspaces.json': {
      active: 'default workspace',
      list: ['default workspace']
    }
  };

  for (const [file, content] of Object.entries(defaults)) {
    const filePath = path.join(configDir, file);
    if (!existsSync(filePath)) {
      await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
    }
  }

  // Ensure default workspace exists
  const defaultWorkspacePath = path.join(workspacesDir, 'default workspace.json');
  if (!existsSync(defaultWorkspacePath)) {
    await fs.writeFile(defaultWorkspacePath, JSON.stringify({ folders: [], tabs: [], activeTabId: '' }, null, 2), 'utf-8');
  }
}

export async function loadConfig() {
  const configDir = path.join(getConfigDir(), 'config');
  
  const readJson = async (file: string, fallback: any) => {
    try {
      const data = await fs.readFile(path.join(configDir, file), 'utf-8');
      return JSON.parse(data);
    } catch {
      return fallback;
    }
  };

  const appearance = await readJson('appearance.json', { theme: 'dark' });
  const keybindings = await readJson('keybindings.json', { commandTab: 'META+X', chatTab: 'META+Y' });
  const ai = await readJson('ai.json', { provider: 'gemini', configs: {} });

  return {
    theme: appearance.theme || 'dark',
    keybindings: {
      commandTab: keybindings.commandTab || 'META+X',
      chatTab: keybindings.chatTab || 'META+Y'
    },
    aiProvider: ai.provider || 'gemini',
    aiConfigs: ai.configs || {}
  };
}

export async function saveConfig(settings: any) {
  const configDir = path.join(getConfigDir(), 'config');

  const appearance = { theme: settings.theme };
  const keybindings = { commandTab: settings.keybindings?.commandTab, chatTab: settings.keybindings?.chatTab };
  const ai = { provider: settings.aiProvider, configs: settings.aiConfigs };

  await fs.writeFile(path.join(configDir, 'appearance.json'), JSON.stringify(appearance, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'keybindings.json'), JSON.stringify(keybindings, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'ai.json'), JSON.stringify(ai, null, 2), 'utf-8');
  
  return true;
}

// Workspace Logic

async function getWorkspacesConfig() {
  const configPath = path.join(getConfigDir(), 'config', 'workspaces.json');
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { active: 'default workspace', list: ['default workspace'] };
  }
}

async function saveWorkspacesConfig(config: any) {
  const configPath = path.join(getConfigDir(), 'config', 'workspaces.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function getWorkspacesList() {
  return await getWorkspacesConfig();
}

export async function createWorkspace(name: string) {
  const wsConfig = await getWorkspacesConfig();
  if (wsConfig.list.includes(name)) {
    throw new Error('Workspace already exists');
  }
  
  wsConfig.list.push(name);
  wsConfig.active = name;

  const newWorkspacePath = path.join(getConfigDir(), 'workspaces', `${name}.json`);
  await fs.writeFile(newWorkspacePath, JSON.stringify({ folders: [], tabs: [], activeTabId: '' }, null, 2), 'utf-8');
  await saveWorkspacesConfig(wsConfig);

  return wsConfig;
}

export async function switchWorkspace(name: string) {
  const wsConfig = await getWorkspacesConfig();
  if (!wsConfig.list.includes(name)) {
    throw new Error('Workspace not found');
  }
  wsConfig.active = name;
  await saveWorkspacesConfig(wsConfig);
  return wsConfig;
}

export async function addWorkspaceFolder(folderPath: string) {
  const wsConfig = await getWorkspacesConfig();
  const activeWs = wsConfig.active;
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${activeWs}.json`);
  
  let wsData: { folders: string[], tabs?: any[], activeTabId?: string } = { folders: [], tabs: [], activeTabId: '' };
  try {
    const data = await fs.readFile(workspacePath, 'utf-8');
    wsData = JSON.parse(data);
  } catch {}

  if (!wsData.folders.includes(folderPath)) {
    wsData.folders.push(folderPath);
    await fs.writeFile(workspacePath, JSON.stringify(wsData, null, 2), 'utf-8');
  }
}

export async function getWorkspaceFolders() {
  const wsConfig = await getWorkspacesConfig();
  const activeWs = wsConfig.active;
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${activeWs}.json`);
  
  try {
    const data = await fs.readFile(workspacePath, 'utf-8');
    return JSON.parse(data).folders || [];
  } catch {
    return [];
  }
}

export async function getWorkspaceState() {
  const wsConfig = await getWorkspacesConfig();
  const activeWs = wsConfig.active;
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${activeWs}.json`);
  
  try {
    const data = await fs.readFile(workspacePath, 'utf-8');
    const parsed = JSON.parse(data);
    return { tabs: parsed.tabs || [], activeTabId: parsed.activeTabId || '' };
  } catch {
    return { tabs: [], activeTabId: '' };
  }
}

export async function saveWorkspaceState(tabs: any[], activeTabId: string) {
  const wsConfig = await getWorkspacesConfig();
  const activeWs = wsConfig.active;
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${activeWs}.json`);
  
  let wsData: any = { folders: [], tabs: [], activeTabId: '' };
  try {
    const data = await fs.readFile(workspacePath, 'utf-8');
    wsData = JSON.parse(data);
  } catch {}

  wsData.tabs = tabs;
  wsData.activeTabId = activeTabId;
  await fs.writeFile(workspacePath, JSON.stringify(wsData, null, 2), 'utf-8');
}
