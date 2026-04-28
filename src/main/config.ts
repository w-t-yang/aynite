import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

// Helper to expand ~ to home directory
function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

export function getConfigDir() {
  if (process.platform === 'win32') {
    return path.join(app.getPath('appData'), 'aynite');
  } else {
    return path.join(os.homedir(), '.aynite');
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

  // Ensure skills.json exists in ~/.aynite/skills
  const skillsDir = path.join(baseDir, 'skills');
  const skillsConfigPath = path.join(skillsDir, 'skills.json');
  if (!existsSync(skillsConfigPath)) {
    await fs.writeFile(skillsConfigPath, JSON.stringify({ folders: [skillsDir] }, null, 2), 'utf-8');
  }

  // Ensure commands.json exists in ~/.aynite/commands
  const commandsDir = path.join(baseDir, 'commands');
  const commandsConfigPath = path.join(commandsDir, 'commands.json');
  if (!existsSync(commandsConfigPath)) {
    await fs.writeFile(commandsConfigPath, JSON.stringify({ folders: [commandsDir] }, null, 2), 'utf-8');
  }

  // Ensure default skills exist
  const skillsToInstall = ['skill-creator', 'command-creator', 'hello-skill'];
  for (const skillName of skillsToInstall) {
    const skillPath = path.join(skillsDir, skillName);
    if (!existsSync(skillPath)) {
      await restoreSkill(skillName);
    }
  }

  // Ensure default commands exist
  const commandsToInstall = ['hello-command'];
  for (const cmdName of commandsToInstall) {
    const cmdPath = path.join(commandsDir, cmdName);
    if (!existsSync(cmdPath)) {
      await restoreCommand(cmdName);
    }
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

  const skills = await getSkillsConfig();

  return {
    theme: appearance.theme || 'dark',
    keybindings: keybindings,
    aiProvider: ai.provider || 'gemini',
    aiConfigs: ai.configs || {},
    skills,
    commands: await getCommandsConfig(),
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
  
  if (settings.skills) {
    await saveSkillsConfig(settings.skills);
  }
  if (settings.commands) {
    await saveCommandsConfig(settings.commands);
  }

  return true;
}

// Skills Logic

export async function getSkillsConfig() {
  const skillsDir = path.join(getConfigDir(), 'skills');
  const configPath = path.join(skillsDir, 'skills.json');
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { folders: [skillsDir] };
  }
}

export async function saveSkillsConfig(config: any) {
  const skillsDir = path.join(getConfigDir(), 'skills');
  const configPath = path.join(skillsDir, 'skills.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function restoreSkill(skillName: string) {
  const skillsDir = path.join(getConfigDir(), 'skills');
  const bundledSkillsPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'skills') 
    : path.join(app.getAppPath(), 'resources', 'skills');
  
  const srcDir = path.join(bundledSkillsPath, skillName);
  const destDir = path.join(skillsDir, skillName);

  if (existsSync(srcDir)) {
    await fs.cp(srcDir, destDir, { recursive: true });
    return true;
  }
  return false;
}

export async function restoreDefaultSkills() {
  const skillsToRestore = ['skill-creator', 'command-creator', 'hello-skill'];
  let allSuccess = true;
  for (const skill of skillsToRestore) {
    const success = await restoreSkill(skill);
    if (!success) allSuccess = false;
  }
  return allSuccess;
}

export async function listAvailableSkills() {
  const config = await getSkillsConfig();
  const skills: any[] = [];

  for (const folder of config.folders) {
    if (!existsSync(folder)) continue;
    try {
      const items = readdirSync(folder);
      for (const item of items) {
        const itemPath = path.join(folder, item);
        const skillMdPath = path.join(itemPath, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const content = await fs.readFile(skillMdPath, 'utf-8');
          // Optional YAML frontmatter
          const match = content.match(/^\s*---\r?\n([\s\S]*?)\r?\n---/);
          let meta: any = {};
          if (match) {
            try {
              meta = yaml.load(match[1]) || {};
            } catch (e) {
              console.error(`Error parsing YAML in ${skillMdPath}`, e);
            }
          }
          
          // Always push if SKILL.md exists
          skills.push({
            name: meta.name || item,
            description: meta.description || '',
            path: itemPath
          });
        }
      }
    } catch (e) {
      console.error(`Error scanning folder ${folder}`, e);
    }
  }
  return skills;
}

// Commands Logic

export async function getCommandsConfig() {
  const commandsDir = path.join(getConfigDir(), 'commands');
  const configPath = path.join(commandsDir, 'commands.json');
  try {
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { folders: [commandsDir] };
  }
}

export async function saveCommandsConfig(config: any) {
  const commandsDir = path.join(getConfigDir(), 'commands');
  const configPath = path.join(commandsDir, 'commands.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function listAvailableCommands() {
  const config = await getCommandsConfig();
  const commands: any[] = [];

  for (const folder of config.folders) {
    if (!existsSync(folder)) continue;
    try {
      const items = readdirSync(folder);
      for (const item of items) {
        const itemPath = path.join(folder, item);
        const cmdMdPath = path.join(itemPath, 'COMMAND.md');
        if (existsSync(cmdMdPath)) {
          const content = await fs.readFile(cmdMdPath, 'utf-8');
          const match = content.match(/^---\r?\n([\s\S]*?)\n---/);
          if (match) {
            try {
              const meta: any = yaml.load(match[1]);
              commands.push({
                name: meta.name || item,
                description: meta.description || '',
                parameters: meta.parameters || [],
                example: meta.example || '',
                path: itemPath
              });
            } catch (e) {
              console.error(`Error parsing YAML in ${cmdMdPath}`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error(`Error scanning folder ${folder}`, e);
    }
  }
  return commands;
}

export async function restoreDefaultCommands() {
  const commandsToRestore = ['hello-command'];
  let allSuccess = true;
  for (const cmd of commandsToRestore) {
    const success = await restoreCommand(cmd);
    if (!success) allSuccess = false;
  }
  return allSuccess;
}

export async function restoreCommand(commandName: string) {
  const commandsDir = path.join(getConfigDir(), 'commands');
  const bundledCommandsPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'commands') 
    : path.join(app.getAppPath(), 'resources', 'commands');
  
  const srcDir = path.join(bundledCommandsPath, commandName);
  const destDir = path.join(commandsDir, commandName);

  if (existsSync(srcDir)) {
    await fs.cp(srcDir, destDir, { recursive: true });
    return true;
  }
  return false;
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
    const folders = JSON.parse(data).folders || [];
    return folders.map((f: string) => expandHome(f));
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
