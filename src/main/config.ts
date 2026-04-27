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

const DEFAULT_KEYBINDINGS = {
  commandTab: 'META+X',
  chatTab: 'META+Y',
  closeTab: 'CTRL+W',
  viewMode: {
    enterEdit: 'A',
    moveDown: 'J',
    moveUp: 'K',
    moveLeft: 'H',
    moveRight: 'L',
    search: '/',
    prevLine: 'CTRL+P',
    nextLine: 'CTRL+N',
    forwardChar: 'CTRL+F',
    backwardChar: 'CTRL+B',
    startOfLine: 'CTRL+A',
    endOfLine: 'CTRL+E'
  },
  editMode: {
    exitEdit: 'ESCAPE',
    endOfLine: 'CTRL+E',
    startOfLine: 'CTRL+A',
    killLine: 'CTRL+K',
    copy: 'CTRL+C',
    paste: 'CTRL+V',
    selectAll: 'CTRL+Q',
    cut: 'CTRL+X',
    prevLine: 'CTRL+P',
    nextLine: 'CTRL+N',
    forwardChar: 'CTRL+F',
    backwardChar: 'CTRL+B'
  }
};

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

  // Default values
  const aiDefault = { 
    provider: 'gemini', 
    configs: { 
      gemini: { apiKey: '', url: '' },
      deepseek: { apiKey: '', url: '' },
      ollama: { url: 'http://localhost:11434', model: 'gemma:e4b', contextWindow: 8192 }
    } 
  };
  const appearanceDefault = { theme: 'dark' };
  const keybindingsDefault = DEFAULT_KEYBINDINGS;
  const configDefault = { lastUsed: new Date().toISOString() };
  const workspacesDefault = { active: 'default workspace', list: ['default workspace'] };

  const checkAndWrite = async (filename: string, content: any) => {
    const p = path.join(configDir, filename);
    if (!existsSync(p)) {
      await fs.writeFile(p, JSON.stringify(content, null, 2), 'utf-8');
    }
  };

  await checkAndWrite('ai.json', aiDefault);
  await checkAndWrite('appearance.json', appearanceDefault);
  await checkAndWrite('keybindings.json', keybindingsDefault);
  await checkAndWrite('config.json', configDefault);
  await checkAndWrite('workspaces.json', workspacesDefault);

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
  const ai = await readJson('ai.json', { provider: 'gemini', configs: {} });
  let keybindings = await readJson('keybindings.json', DEFAULT_KEYBINDINGS);
  const mainConfig = await readJson('config.json', {});

  // Recursive merge/repair for keybindings
  let modified = false;
  const ensureKeys = (target: any, defaults: any) => {
    for (const key in defaults) {
      if (target[key] === undefined) {
        target[key] = JSON.parse(JSON.stringify(defaults[key]));
        modified = true;
      } else if (typeof defaults[key] === 'object' && defaults[key] !== null) {
        if (typeof target[key] !== 'object' || target[key] === null) {
          target[key] = JSON.parse(JSON.stringify(defaults[key]));
          modified = true;
        } else {
          ensureKeys(target[key], defaults[key]);
        }
      }
    }
  };

  ensureKeys(keybindings, DEFAULT_KEYBINDINGS);

  if (modified) {
    await fs.writeFile(path.join(configDir, 'keybindings.json'), JSON.stringify(keybindings, null, 2), 'utf-8');
  }

  return {
    theme: appearance.theme || 'dark',
    keybindings: keybindings,
    aiProvider: ai.provider || 'gemini',
    aiConfigs: ai.configs || {},
    ...mainConfig
  };
}

export async function saveConfig(settings: any) {
  const configDir = path.join(getConfigDir(), 'config');

  const appearance = { theme: settings.theme };
  const ai = { provider: settings.aiProvider, configs: settings.aiConfigs };
  const keybindings = settings.keybindings || DEFAULT_KEYBINDINGS;
  
  // Extract remaining fields for config.json
  const { theme, aiProvider, aiConfigs, keybindings: _, ...rest } = settings;
  const mainConfig = { ...rest, updatedAt: new Date().toISOString() };

  await fs.writeFile(path.join(configDir, 'appearance.json'), JSON.stringify(appearance, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'ai.json'), JSON.stringify(ai, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'keybindings.json'), JSON.stringify(keybindings, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'config.json'), JSON.stringify(mainConfig, null, 2), 'utf-8');
  
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

export async function removeWorkspaceFolder(folderPath: string) {
  const wsConfig = await getWorkspacesConfig();
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${wsConfig.active}.json`);
  try {
    const data = JSON.parse(await fs.readFile(workspacePath, 'utf-8'));
    if (data.folders.includes(folderPath)) {
      data.folders = data.folders.filter((f: string) => f !== folderPath);
      await fs.writeFile(workspacePath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch {}
}

export async function renameWorkspaceFolder(oldPath: string, newPath: string) {
  const wsConfig = await getWorkspacesConfig();
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${wsConfig.active}.json`);
  try {
    const data = JSON.parse(await fs.readFile(workspacePath, 'utf-8'));
    if (data.folders.includes(oldPath)) {
      data.folders = data.folders.map((f: string) => f === oldPath ? newPath : f);
      await fs.writeFile(workspacePath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch {}
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
