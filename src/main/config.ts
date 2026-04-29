import { app } from 'electron';
import fs from 'fs/promises';
import { existsSync, readdirSync } from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { DEFAULT_KEYBINDINGS } from './default_configs/keybindings';
import { DEFAULT_THEMES } from './default_configs/themes';
import { DEFAULT_PROMPTS } from './default_configs/prompts';

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

// Constants imported from default_configs

export async function initThemes() {
  const themesDir = path.join(getConfigDir(), 'themes');
  if (!existsSync(themesDir)) {
    await fs.mkdir(themesDir, { recursive: true });
  }
  for (const [key, theme] of Object.entries(DEFAULT_THEMES)) {
    const themePath = path.join(themesDir, `${key}.json`);
    if (!existsSync(themePath)) {
      await fs.writeFile(themePath, JSON.stringify(theme, null, 2), 'utf-8');
    }
  }
}

export async function getThemesList(): Promise<any[]> {
  const themesDir = path.join(getConfigDir(), 'themes');
  const themes: any[] = [];
  try {
    const files = readdirSync(themesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const data = await fs.readFile(path.join(themesDir, file), 'utf-8');
        const theme = JSON.parse(data);
        themes.push({ ...theme, id: file.replace('.json', '') });
      } catch (e) {
        console.error(`Error reading theme ${file}`, e);
      }
    }
  } catch (e) {
    console.error('Error listing themes', e);
  }
  return themes;
}

export async function getTheme(name: string): Promise<any> {
  const themePath = path.join(getConfigDir(), 'themes', `${name}.json`);
  try {
    const data = await fs.readFile(themePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return DEFAULT_THEMES['dark'];
  }
}

export async function saveTheme(name: string, data: any): Promise<boolean> {
  const themePath = path.join(getConfigDir(), 'themes', `${name}.json`);
  await fs.writeFile(themePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
}

export async function restoreDefaultTheme(name: string): Promise<boolean> {
  if (!DEFAULT_THEMES[name]) return false;
  const themePath = path.join(getConfigDir(), 'themes', `${name}.json`);
  await fs.writeFile(themePath, JSON.stringify(DEFAULT_THEMES[name], null, 2), 'utf-8');
  return true;
}

export async function deleteTheme(name: string): Promise<boolean> {
  if (DEFAULT_THEMES[name]) return false; // Cannot delete system themes
  const themePath = path.join(getConfigDir(), 'themes', `${name}.json`);
  if (existsSync(themePath)) {
    await fs.unlink(themePath);
    return true;
  }
  return false;
}

export async function getSystemFonts(): Promise<string[]> {
  try {
    const { stdout } = await (await import('util')).promisify((await import('child_process')).exec)('fc-list :lang=en --format="%{family}\n"');
    const fonts = [...new Set(stdout.split('\n').map(f => f.trim()).filter(Boolean))].sort();
    return fonts;
  } catch {
    return ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
  }
}

export function isSystemTheme(name: string): boolean {
  return !!DEFAULT_THEMES[name];
}

export async function initAppFolders() {
  const baseDir = getConfigDir();

  const folders = ['config', 'skills', 'commands', 'workspaces', 'themes', 'logs', 'prompts'];
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
    provider: 'ollama',
    configs: {
      ollama: { url: 'http://localhost:11434', model: '', contextWindow: 8192 },
      deepseek: { apiKey: '', url: 'https://api.deepseek.com', model: 'deepseek-v4-pro' },
      gemini: { apiKey: '', url: 'https://generativelanguage.googleapis.com', model: 'gemini-3-flash-preview' },
      openai: { apiKey: '', url: 'https://api.openai.com/v1', model: 'gpt-5.4' },
      anthropic: { apiKey: '', url: 'https://api.anthropic.com', model: 'claude-sonnet-4.6' },
      others: { apiKey: '', url: '', model: '', compatibility: 'openai' }
    }


  };

  const keybindingsDefault = DEFAULT_KEYBINDINGS;
  const skillsDir = path.join(baseDir, 'skills');
  const commandsDir = path.join(baseDir, 'commands');

  const configDefault = {
    lastUsed: new Date().toISOString(),
    activeTheme: 'nord',
    skills: { folders: [skillsDir] },
    commands: { folders: [commandsDir] },
    prompts: { files: Object.keys(DEFAULT_PROMPTS).map(f => path.join(baseDir, "prompts", f)) }
  };
  const ignoreDefault = ['.git', 'node_modules', '.DS_Store', 'dist', 'build', 'out', 'target', 'vendor', 'venv'].join('\n');
  const workspacesDefault = { active: 'default workspace', list: ['default workspace'] };

  const checkAndWrite = async (filename: string, content: any) => {
    const p = path.join(configDir, filename);
    if (!existsSync(p)) {
      await fs.writeFile(p, JSON.stringify(content, null, 2), 'utf-8');
    }
  };

  await checkAndWrite('ai.json', aiDefault);
  await checkAndWrite('keybindings.json', keybindingsDefault);
  await checkAndWrite('config.json', configDefault);
  await checkAndWrite('workspaces.json', workspacesDefault);

  const ignorePath = path.join(configDir, 'ignore');
  if (!existsSync(ignorePath)) {
    await fs.writeFile(ignorePath, ignoreDefault, 'utf-8');
  }

  // Initialize themes
  await initThemes();

  // Ensure default workspace exists
  const defaultWorkspacePath = path.join(workspacesDir, 'default workspace.json');
  if (!existsSync(defaultWorkspacePath)) {
    await fs.writeFile(defaultWorkspacePath, JSON.stringify({ folders: [], tabs: [], activeTabId: '' }, null, 2), 'utf-8');
  }

  // Ensure skills folder exists
  if (!existsSync(skillsDir)) {
    await fs.mkdir(skillsDir, { recursive: true });
  }

  // Ensure commands folder exists
  if (!existsSync(commandsDir)) {
    await fs.mkdir(commandsDir, { recursive: true });
  }

  // Ensure default skills exist
  const skillsToInstall = ['skill-creator', 'command-creator', 'hello-skill', 'theme-creator'];
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

  // Ensure default prompts exist
  const promptsDir = path.join(baseDir, 'prompts');
  const defaultPrompts = DEFAULT_PROMPTS;

  for (const [filename, content] of Object.entries(defaultPrompts)) {
    const p = path.join(promptsDir, filename);
    if (!existsSync(p)) {
      await fs.writeFile(p, content, 'utf-8');
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

  // Migrate skills/commands if missing in config.json
  if (!mainConfig.skills) {
    mainConfig.skills = await getSkillsConfig();
  }
  if (!mainConfig.commands) {
    mainConfig.commands = await getCommandsConfig();
  }

  // Migrate: if old appearance.json exists, move theme to config.json activeTheme then delete it
  const appearancePath = path.join(configDir, 'appearance.json');
  if (existsSync(appearancePath)) {
    try {
      const appearance = JSON.parse(await fs.readFile(appearancePath, 'utf-8'));
      if (appearance.theme && !mainConfig.activeTheme) {
        mainConfig.activeTheme = appearance.theme;
      }
      // Remove the deprecated file
      await fs.unlink(appearancePath);
    } catch { }
  }

  // Remove ignore and other fields from mainConfig to avoid duplication/stale data in the return object
  const { ignore: _, ...restConfig } = mainConfig;

  return {
    activeTheme: mainConfig.activeTheme || 'dark',
    ignore: await getIgnorePatterns(),
    keybindings: keybindings,
    aiProvider: ai.provider || 'gemini',
    aiConfigs: ai.configs || {},
    ...restConfig
  };
}

export async function getIgnorePatterns(): Promise<string[]> {
  const ignorePath = path.join(getConfigDir(), 'config', 'ignore');
  try {
    if (!existsSync(ignorePath)) return ['.git', 'node_modules'];
    const data = await fs.readFile(ignorePath, 'utf-8');
    return data.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  } catch {
    return ['.git', 'node_modules'];
  }
}

export async function saveConfig(settings: any) {
  const configDir = path.join(getConfigDir(), 'config');

  const ai = { provider: settings.aiProvider, configs: settings.aiConfigs };
  const keybindings = settings.keybindings || DEFAULT_KEYBINDINGS;

  // Extract fields, specifically removing 'ignore' from config.json
  const { aiProvider, aiConfigs, keybindings: _, ignore, ...rest } = settings;
  const mainConfig = { ...rest, updatedAt: new Date().toISOString() };

  await fs.writeFile(path.join(configDir, 'ai.json'), JSON.stringify(ai, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'keybindings.json'), JSON.stringify(keybindings, null, 2), 'utf-8');
  await fs.writeFile(path.join(configDir, 'config.json'), JSON.stringify(mainConfig, null, 2), 'utf-8');

  // Save ignore patterns to the dedicated file
  if (ignore !== undefined) {
    const ignorePath = path.join(configDir, 'ignore');
    const ignoreContent = Array.isArray(ignore) ? ignore.join('\n') : ignore;
    await fs.writeFile(ignorePath, ignoreContent, 'utf-8');
  }

  return true;
}

// Skills Logic

export async function getSkillsConfig() {
  const configDir = path.join(getConfigDir(), 'config');
  const mainConfigPath = path.join(configDir, 'config.json');

  if (existsSync(mainConfigPath)) {
    try {
      const data = await fs.readFile(mainConfigPath, 'utf-8');
      const mainConfig = JSON.parse(data);
      if (mainConfig.skills) return mainConfig.skills;
    } catch { }
  }

  // Legacy fallback
  const skillsDir = path.join(getConfigDir(), 'skills');
  const legacyPath = path.join(skillsDir, 'skills.json');
  try {
    const data = await fs.readFile(legacyPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { folders: [skillsDir] };
  }
}

export async function saveSkillsConfig(config: any) {
  const configDir = path.join(getConfigDir(), 'config');
  const mainConfigPath = path.join(configDir, 'config.json');

  let mainConfig: any = {};
  if (existsSync(mainConfigPath)) {
    try {
      const data = await fs.readFile(mainConfigPath, 'utf-8');
      mainConfig = JSON.parse(data);
    } catch { }
  }

  mainConfig.skills = config;
  await fs.writeFile(mainConfigPath, JSON.stringify(mainConfig, null, 2), 'utf-8');
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

async function findFilesRecursively(dir: string, filenames: string[], ignoreDirs: string[] = ['node_modules', '.git']): Promise<string[]> {
  let results: string[] = [];
  try {
    const list = await fs.readdir(dir, { withFileTypes: true });
    for (const file of list) {
      const res = path.resolve(dir, file.name);
      if (file.isDirectory()) {
        if (ignoreDirs.includes(file.name)) continue;
        results = results.concat(await findFilesRecursively(res, filenames, ignoreDirs));
      } else {
        if (filenames.includes(file.name)) {
          results.push(res);
        }
      }
    }
  } catch (e) {
    // console.error(`Error searching directory ${dir}`, e);
  }
  return results;
}

export async function listAvailableSkills() {
  const config = await getSkillsConfig();
  const skills: any[] = [];
  const seenNames = new Map<string, string>(); // name -> path

  for (const folder of config.folders) {
    if (!existsSync(folder)) continue;
    try {
      const skillMdFiles = await findFilesRecursively(folder, ['SKILL.md']);
      for (const skillMdPath of skillMdFiles) {
        const itemPath = path.dirname(skillMdPath);
        const item = path.basename(itemPath);

        try {
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

          const name = meta.name || item;

          if (seenNames.has(name)) {
            if (seenNames.get(name) === itemPath) {
              // Already registered from same path, ignore
              continue;
            } else {
              // Same name, different path - ignore (don't override)
              console.warn(`Skill name collision: "${name}" at ${itemPath} ignored. Already registered from ${seenNames.get(name)}`);
              continue;
            }
          }

          skills.push({
            name: name,
            description: meta.description || '',
            path: itemPath
          });
          seenNames.set(name, itemPath);
        } catch (e) {
          console.error(`Error reading skill at ${skillMdPath}`, e);
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
  const configDir = path.join(getConfigDir(), 'config');
  const mainConfigPath = path.join(configDir, 'config.json');

  if (existsSync(mainConfigPath)) {
    try {
      const data = await fs.readFile(mainConfigPath, 'utf-8');
      const mainConfig = JSON.parse(data);
      if (mainConfig.commands) return mainConfig.commands;
    } catch { }
  }

  // Legacy fallback
  const commandsDir = path.join(getConfigDir(), 'commands');
  const legacyPath = path.join(commandsDir, 'commands.json');
  try {
    const data = await fs.readFile(legacyPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { folders: [commandsDir] };
  }
}

export async function saveCommandsConfig(config: any) {
  const configDir = path.join(getConfigDir(), 'config');
  const mainConfigPath = path.join(configDir, 'config.json');

  let mainConfig: any = {};
  if (existsSync(mainConfigPath)) {
    try {
      const data = await fs.readFile(mainConfigPath, 'utf-8');
      mainConfig = JSON.parse(data);
    } catch { }
  }

  mainConfig.commands = config;
  await fs.writeFile(mainConfigPath, JSON.stringify(mainConfig, null, 2), 'utf-8');
}

export async function listAvailableCommands() {
  const config = await getCommandsConfig();
  const commands: any[] = [];
  const seenNames = new Map<string, string>(); // name -> path

  for (const folder of config.folders) {
    if (!existsSync(folder)) continue;
    try {
      const cmdMdFiles = await findFilesRecursively(folder, ['COMMAND.md']);
      for (const cmdMdPath of cmdMdFiles) {
        const itemPath = path.dirname(cmdMdPath);
        const item = path.basename(itemPath);

        try {
          const content = await fs.readFile(cmdMdPath, 'utf-8');
          const match = content.match(/^---\r?\n([\s\S]*?)\n---/);
          if (match) {
            try {
              const meta: any = yaml.load(match[1]);
              const name = meta.name || item;

              if (seenNames.has(name)) {
                if (seenNames.get(name) === itemPath) {
                  continue;
                } else {
                  console.warn(`Command name collision: "${name}" at ${itemPath} ignored. Already registered from ${seenNames.get(name)}`);
                  continue;
                }
              }

              commands.push({
                name: name,
                description: meta.description || '',
                parameters: meta.parameters || [],
                example: meta.example || '',
                path: itemPath
              });
              seenNames.set(name, itemPath);
            } catch (e) {
              console.error(`Error parsing YAML in ${cmdMdPath}`, e);
            }
          }
        } catch (e) {
          console.error(`Error reading command at ${cmdMdPath}`, e);
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

export async function saveChatLog(sessionId: string, messages: any[]) {
  const baseDir = getConfigDir();
  const dateStr = new Date().toISOString().split('T')[0];
  const logsDir = path.join(baseDir, 'logs', dateStr);

  if (!existsSync(logsDir)) {
    await fs.mkdir(logsDir, { recursive: true });
  }

  const logPath = path.join(logsDir, `${sessionId}.json`);
  await fs.writeFile(logPath, JSON.stringify(messages, null, 2), 'utf-8');
}

export async function loadChatLog(sessionId: string, date: string) {
  const logPath = path.join(getConfigDir(), 'logs', date, `${sessionId}.json`);
  try {
    const data = await fs.readFile(logPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Prompts Logic

export async function getPromptsConfig() {
  const configDir = path.join(getConfigDir(), 'config');
  const mainConfigPath = path.join(configDir, 'config.json');

  if (existsSync(mainConfigPath)) {
    try {
      const data = await fs.readFile(mainConfigPath, 'utf-8');
      const mainConfig = JSON.parse(data);
      if (mainConfig.prompts) return mainConfig.prompts;
    } catch { }
  }

  const baseDir = getConfigDir();
  return {
    files: [
      path.join(baseDir, 'prompts', 'about-me.md'),
      path.join(baseDir, 'prompts', 'about-skills.md'),
      path.join(baseDir, 'prompts', 'about-commands.md'),
      path.join(baseDir, 'prompts', 'about-files.md')
    ]
  };
}

export async function savePromptsConfig(config: any) {
  const configDir = path.join(getConfigDir(), 'config');
  const mainConfigPath = path.join(configDir, 'config.json');

  let mainConfig: any = {};
  if (existsSync(mainConfigPath)) {
    try {
      const data = await fs.readFile(mainConfigPath, 'utf-8');
      mainConfig = JSON.parse(data);
    } catch { }
  }

  mainConfig.prompts = config;
  await fs.writeFile(mainConfigPath, JSON.stringify(mainConfig, null, 2), 'utf-8');
}

export async function restoreDefaultPrompts() {
  const baseDir = getConfigDir();
  const promptsDir = path.join(baseDir, 'prompts');

  if (!existsSync(promptsDir)) {
    await fs.mkdir(promptsDir, { recursive: true });
  }

  const defaultPrompts = DEFAULT_PROMPTS;

  for (const [filename, content] of Object.entries(defaultPrompts)) {
    const p = path.join(promptsDir, filename);
    await fs.writeFile(p, content, 'utf-8');
  }

  const config = {
    files: Object.keys(defaultPrompts).map(f => path.join(promptsDir, f))
  };
  await savePromptsConfig(config);
  return config;
}

export async function getMergedSystemPrompt(customFiles?: string[]) {
  const files = customFiles || (await getPromptsConfig()).files || [];
  let merged = '';

  for (const filePath of files) {
    try {
      const content = await fs.readFile(expandHome(filePath), 'utf-8');
      merged += content + '\n\n';
    } catch (e) {
      console.error(`Error reading prompt file ${filePath}`, e);
    }
  }

  return merged.trim();
}

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

async function safeReadWorkspaceData(workspacePath: string): Promise<any | null> {
  try {
    if (!existsSync(workspacePath)) return { folders: [], tabs: [], activeTabId: '' };
    const content = await fs.readFile(workspacePath, 'utf-8');
    if (!content.trim()) return null;
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed to read/parse workspace file at ${workspacePath}:`, e);
    return null;
  }
}

export async function addWorkspaceFolder(folderPath: string) {
  const wsConfig = await getWorkspacesConfig();
  const activeWs = wsConfig.active;
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${activeWs}.json`);

  const wsData = await safeReadWorkspaceData(workspacePath);
  if (!wsData) return; // Prevent overwriting if read failed

  if (!wsData.folders.includes(folderPath)) {
    wsData.folders.push(folderPath);
    await fs.writeFile(workspacePath, JSON.stringify(wsData, null, 2), 'utf-8');
  }
}

export async function removeWorkspaceFolder(folderPath: string) {
  const wsConfig = await getWorkspacesConfig();
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${wsConfig.active}.json`);
  const data = await safeReadWorkspaceData(workspacePath);
  if (!data) return;

  if (data.folders.includes(folderPath)) {
    data.folders = data.folders.filter((f: string) => f !== folderPath);
    await fs.writeFile(workspacePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

export async function renameWorkspaceFolder(oldPath: string, newPath: string) {
  const wsConfig = await getWorkspacesConfig();
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${wsConfig.active}.json`);
  const data = await safeReadWorkspaceData(workspacePath);
  if (!data) return;

  if (data.folders.includes(oldPath)) {
    data.folders = data.folders.map((f: string) => f === oldPath ? newPath : f);
    await fs.writeFile(workspacePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

export async function reorderWorkspaceFolders(newFolders: string[]) {
  const wsConfig = await getWorkspacesConfig();
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${wsConfig.active}.json`);
  const data = await safeReadWorkspaceData(workspacePath);
  if (!data) return;

  data.folders = newFolders;
  await fs.writeFile(workspacePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getWorkspaceFolders() {
  try {
    const wsConfig = await getWorkspacesConfig();
    const activeWs = wsConfig.active;
    const workspacePath = path.join(getConfigDir(), 'workspaces', `${activeWs}.json`);

    if (!existsSync(workspacePath)) {
      console.warn(`Workspace file not found: ${workspacePath}`);
      return { data: [], debugPath: workspacePath };
    }

    const data = await fs.readFile(workspacePath, 'utf-8');
    const parsed = JSON.parse(data);
    const folders = parsed.folders || [];
    return { data: folders.map((f: string) => expandHome(f)), debugPath: workspacePath };
  } catch (e) {
    console.error('getWorkspaceFolders failed:', e);
    return { data: [], error: String(e) };
  }
}

export async function getWorkspaceState() {
  const wsConfig = await getWorkspacesConfig();
  const activeWs = wsConfig.active;
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${activeWs}.json`);

  const parsed = await safeReadWorkspaceData(workspacePath);
  if (!parsed) return { name: activeWs, tabs: [], activeTabId: '' };

  return {
    name: activeWs,
    tabs: parsed.tabs || [],
    activeTabId: parsed.activeTabId || ''
  };
}

export async function saveWorkspaceState(workspaceName: string, tabs: any[], activeTabId: string) {
  const workspacePath = path.join(getConfigDir(), 'workspaces', `${workspaceName}.json`);

  const wsData = await safeReadWorkspaceData(workspacePath);
  if (!wsData) return; // Prevent overwriting if read failed

  wsData.tabs = tabs;
  wsData.activeTabId = activeTabId;
  await fs.writeFile(workspacePath, JSON.stringify(wsData, null, 2), 'utf-8');
}
