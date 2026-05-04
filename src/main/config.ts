import { app } from 'electron';
import yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { DEFAULT_KEYBINDINGS } from '../lib/constants/keybindings';
import { DEFAULT_THEMES } from '../lib/constants/themes';
import { 
  getAyniteDir, 
  expandHome, 
  getAyniteConfigDir, 
  getAynitePromptPath,
  getWorkspacesConfigPath,
  getWorkspaceDataPath,
  getAIConfigPath,
  getKeybindingsConfigPath,
  getIgnoreConfigPath,
  getMainConfigPath,
  getAppearanceConfigPath,
  getThemesDir,
  getThemePath,
  getPlaybookPath,
  getWelcomeMdPath,
  getSkillsDir,
  getCommandsDir,
  getSkillPath,
  getCommandPath,
  getBasename,
  getDirname,
  getAbsolutePath,
  joinPaths,
  ensureDir, 
  readJson, 
  writeJson, 
  readText, 
  writeText,
  exists,
  readdir,
  unlink,
  copy,
  AYNITE_SUBDIRS
} from '../lib/path';
import { getDefaultGlobalPrompts, restoreDefaultPrompts } from './ai';
import { 
  DEFAULT_AI_CONFIG, 
  AGENT_PROMPTS, 
  DEFAULT_AGENTS
} from '../lib/constants/ai';

let notificationCallback: ((data: { type: 'skill' | 'command', path: string, error: string }) => void) | null = null;
let reportedErrors = new Map<string, string>();

export function setConfigNotificationCallback(cb: typeof notificationCallback) {
  notificationCallback = cb;
}

function notifyError(type: 'skill' | 'command', path: string, error: string) {
  if (reportedErrors.get(path) === error) return;
  reportedErrors.set(path, error);
  if (notificationCallback) notificationCallback({ type, path, error });
}

export { getAyniteDir, expandHome };

function getBundledResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  } else {
    return joinPaths(process.cwd(), 'resources');
  }
}

export async function initThemes() {
  const themesDir = getThemesDir();
  await ensureDir(themesDir);
  
  for (const [key, theme] of Object.entries(DEFAULT_THEMES)) {
    const themePath = getThemePath(key);
    if (!(await exists(themePath))) {
      await writeJson(themePath, theme);
    }
  }
}

export async function getThemesList(): Promise<any[]> {
  const themesDir = getThemesDir();
  const themes: any[] = [];
  try {
    const files = (await readdir(themesDir)).filter(f => f.name.endsWith('.json'));
    for (const file of files) {
      try {
        const theme = await readJson(getThemePath(getBasename(file.name, '.json')));
        themes.push({ ...theme, id: getBasename(file.name, '.json') });
      } catch (e) {
        console.error(`Error reading theme ${file.name}`, e);
      }
    }
  } catch (e) {
    console.error('Error listing themes', e);
  }
  return themes;
}

export async function getTheme(name: string): Promise<any> {
  const themePath = getThemePath(name);
  try {
    return await readJson(themePath);
  } catch {
    return DEFAULT_THEMES['light'];
  }
}

export async function saveTheme(name: string, data: any): Promise<boolean> {
  const themePath = getThemePath(name);
  await writeJson(themePath, data);
  return true;
}

export async function restoreDefaultTheme(name: string): Promise<boolean> {
  if (!DEFAULT_THEMES[name]) return false;
  const themePath = getThemePath(name);
  await writeJson(themePath, DEFAULT_THEMES[name]);
  return true;
}

export async function deleteTheme(name: string): Promise<boolean> {
  if (DEFAULT_THEMES[name]) return false; 
  const themePath = getThemePath(name);
  if (await exists(themePath)) {
    await unlink(themePath);
    return true;
  }
  return false;
}

export async function getSystemFonts(): Promise<string[]> {
  try {
    const { stdout } = await execAsync('fc-list :lang=en --format="%{family}\n"');
    return [...new Set(stdout.split('\n').map(f => f.trim()).filter(Boolean))].sort();
  } catch {
    return ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
  }
}

export async function initAppFolders() {
  const baseDir = getAyniteDir();
  const folders = Object.values(AYNITE_SUBDIRS);
  for (const folder of folders) {
    await ensureDir(joinPaths(baseDir, folder));
  }

  const aiDefault = DEFAULT_AI_CONFIG;
  const keybindingsDefault = DEFAULT_KEYBINDINGS;
  const skillsDir = getSkillsDir();
  const commandsDir = getCommandsDir();

  const configDefault = {
    lastUsed: new Date().toISOString(),
    activeTheme: 'light',
    skills: { folders: [skillsDir] },
    commands: { folders: [commandsDir] },
    prompts: { files: getDefaultGlobalPrompts() },
    agents: {
      activeId: 'aynite',
      list: DEFAULT_AGENTS.map(agent => ({
        id: agent.id,
        name: agent.name,
        promptFiles: [getAynitePromptPath(AGENT_PROMPTS[agent.promptKey].filename)]
      }))
    }
  };
  const ignoreDefault = ['node_modules', '.DS_Store', 'dist', 'build', 'out', 'target', 'vendor', 'venv'].join('\n');
  const workspacesDefault = { active: 'aynite-workspace', list: ['aynite-workspace'] };

  await writeJson(getAIConfigPath(), aiDefault);
  await writeJson(getKeybindingsConfigPath(), keybindingsDefault);
  await writeJson(getMainConfigPath(), configDefault);
  await writeJson(getWorkspacesConfigPath(), workspacesDefault);

  const ignorePath = getIgnoreConfigPath();
  if (!(await exists(ignorePath))) {
    await writeText(ignorePath, ignoreDefault);
  }

  await restoreAynitePlaybook();
  await initThemes();

  // Migrate/Initialize workspaces.json
  const workspacesJsonPath = getWorkspacesConfigPath();
  let workspacesConfig: any = null;
  if (await exists(workspacesJsonPath)) {
    try {
      workspacesConfig = await readJson(workspacesJsonPath);
      if (workspacesConfig.active === 'default workspace') {
        workspacesConfig.active = 'aynite-workspace';
        workspacesConfig.list = (workspacesConfig.list || []).map((ws: string) => ws === 'default workspace' ? 'aynite-workspace' : ws);
        if (!workspacesConfig.list.includes('aynite-workspace')) workspacesConfig.list.push('aynite-workspace');
        await writeJson(workspacesJsonPath, workspacesConfig);
      }
    } catch (e) {
      console.error('Error migrating workspaces.json:', e);
    }
  }

  if (!workspacesConfig) {
    await writeJson(getWorkspacesConfigPath(), workspacesDefault);
  }

  // Ensure aynite-workspace.json exists
  const defaultWorkspacePath = getWorkspaceDataPath('aynite-workspace');
  const playbookPath = getPlaybookPath();
  const welcomeMdPath = getWelcomeMdPath();

  let shouldInitWorkspaceFile = !(await exists(defaultWorkspacePath));
  if (!shouldInitWorkspaceFile) {
    try {
      const wsData = await readJson(defaultWorkspacePath);
      if ((!wsData.folders || wsData.folders.length === 0) && (!wsData.tabs || wsData.tabs.length === 0)) {
        shouldInitWorkspaceFile = true;
      }
    } catch {
      shouldInitWorkspaceFile = true;
    }
  }

  if (shouldInitWorkspaceFile) {
    await writeJson(defaultWorkspacePath, {
      folders: [playbookPath],
      tabs: [{
        id: `file-${welcomeMdPath}`,
        type: 'file',
        title: 'Welcome.md',
        filepath: welcomeMdPath
      }],
      activeTabId: `file-${welcomeMdPath}`
    });
  }

  // Ensure default skills/commands
  const skillsDir = getSkillsDir();
  const commandsDir = getCommandsDir();
  for (const skillName of ['skill-creator', 'command-creator', 'hello-skill', 'theme-creator']) {
    if (!(await exists(getSkillPath(skillName)))) {
      await restoreSkill(skillName);
    }
  }
  for (const cmdName of ['hello-command']) {
    if (!(await exists(getCommandPath(cmdName)))) {
      await restoreCommand(cmdName);
    }
  }

  await restoreDefaultPrompts();
}

export async function loadConfig() {
  const ai = await readJson(getAIConfigPath(), { provider: 'gemini', configs: {} });
  let keybindings = await readJson(getKeybindingsConfigPath(), DEFAULT_KEYBINDINGS);
  const mainConfig: any = await readJson(getMainConfigPath(), {});

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
    await writeJson(getKeybindingsConfigPath(), keybindings);
  }

  if (!mainConfig.skills) mainConfig.skills = await getSkillsConfig();
  if (!mainConfig.commands) mainConfig.commands = await getCommandsConfig();
  if (mainConfig.prompts && mainConfig.prompts.files) {
    mainConfig.prompts.files = mainConfig.prompts.files.filter((f: string) => !getBasename(f).startsWith('agent-'));
  }
  if (!mainConfig.agents) {
    mainConfig.agents = {
      activeId: 'aynite',
      list: DEFAULT_AGENTS.map(agent => ({
        id: agent.id,
        name: agent.name,
        promptFiles: [getAynitePromptPath(AGENT_PROMPTS[agent.promptKey].filename)]
      }))
    };
  }

  const appearancePath = getAppearanceConfigPath();
  if (await exists(appearancePath)) {
    try {
      const appearance = await readJson(appearancePath);
      if (appearance.theme && !mainConfig.activeTheme) mainConfig.activeTheme = appearance.theme;
      await unlink(appearancePath);
    } catch { }
  }

  const { ignore: _, ...restConfig } = mainConfig;
  return {
    activeTheme: mainConfig.activeTheme || 'light',
    ignore: await getIgnorePatterns(),
    keybindings: keybindings,
    ai: ai,
    ...restConfig
  };
}

export async function getIgnorePatterns(): Promise<string[]> {
  const ignorePath = getIgnoreConfigPath();
  try {
    if (!(await exists(ignorePath))) return ['.git', 'node_modules'];
    const data = await readText(ignorePath);
    return data.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  } catch {
    return ['.git', 'node_modules'];
  }
}

export async function saveConfig(settings: any) {
  const { ai = DEFAULT_AI_CONFIG, keybindings = DEFAULT_KEYBINDINGS, ignore, ...rest } = settings;
  const mainConfig = { ...rest, updatedAt: new Date().toISOString() };

  await writeJson(getAIConfigPath(), ai);
  await writeJson(getKeybindingsConfigPath(), keybindings);
  await writeJson(getMainConfigPath(), mainConfig);

  if (ignore !== undefined) {
    await writeText(getIgnoreConfigPath(), Array.isArray(ignore) ? ignore.join('\n') : ignore);
  }
  return true;
}

export async function getSkillsConfig() {
  const mainConfigPath = getMainConfigPath();
  try {
    const mainConfig: any = await readJson(mainConfigPath);
    if (mainConfig.skills) return mainConfig.skills;
  } catch { }

  const skillsDir = getSkillsDir();
  return await readJson(joinPaths(skillsDir, 'skills.json'), { folders: [skillsDir] });
}

export async function saveSkillsConfig(config: any) {
  const mainConfigPath = getMainConfigPath();
  const mainConfig: any = await readJson(mainConfigPath, {});
  mainConfig.skills = config;
  await writeJson(mainConfigPath, mainConfig);
}

export async function restoreSkill(skillName: string) {
  const srcDir = joinPaths(getBundledResourcesPath(), 'skills', skillName);
  const destDir = getSkillPath(skillName);
  if (await exists(srcDir)) {
    try {
      await copy(srcDir, destDir, { recursive: true });
      return true;
    } catch (e) {
      console.error(`[Restore] Error copying skill ${skillName}:`, e);
      return false;
    }
  }
  return false;
}

export async function restoreAynitePlaybook() {
  const destDir = getPlaybookPath();
  if (await exists(joinPaths(destDir, 'Welcome.md'))) return true;

  const srcDir = joinPaths(getBundledResourcesPath(), 'aynite-playbook');
  if (await exists(srcDir)) {
    try {
      await copy(srcDir, destDir, { recursive: true });
      return true;
    } catch (e) {
      console.error(`[Restore] Error copying aynite-playbook:`, e);
      return false;
    }
  }
  return false;
}

export async function restoreDefaultSkills() {
  const skillsToRestore = ['skill-creator', 'command-creator', 'hello-skill'];
  let allSuccess = true;
  for (const skill of skillsToRestore) {
    if (!(await restoreSkill(skill))) allSuccess = false;
  }
  return allSuccess;
}

async function findFilesRecursively(dir: string, filenames: string[], ignoreDirs: string[] = ['node_modules', '.git']): Promise<string[]> {
  let results: string[] = [];
  try {
    const list = await readdir(dir);
    for (const file of list) {
      const res = getAbsolutePath(file.name, dir);
      if (file.isDirectory()) {
        if (ignoreDirs.includes(file.name)) continue;
        results = results.concat(await findFilesRecursively(res, filenames, ignoreDirs));
      } else if (filenames.includes(file.name)) {
        results.push(res);
      }
    }
  } catch (e) { }
  return results;
}

export async function listAvailableSkills() {
  const config = await getSkillsConfig();
  const skills: any[] = [];
  const seenNames = new Map<string, string>();

  for (const folder of config.folders) {
    if (!(await exists(folder))) continue;
    const skillMdFiles = await findFilesRecursively(folder, ['SKILL.md']);
    for (const skillMdPath of skillMdFiles) {
      const itemPath = getDirname(skillMdPath);
      try {
        const content = await readText(skillMdPath);
        const match = content.match(/^\s*---\r?\n([\s\S]*?)\r?\n---/);
        let meta: any = {};
        let yamlError: string | null = null;
        if (match) {
          try {
            meta = yaml.load(match[1]) || {};
          } catch (e: any) {
            yamlError = e.message;
            notifyError('skill', skillMdPath, e.message);
          }
        }
        const name = meta.name || getBasename(itemPath);
        if (seenNames.has(name)) continue;

        skills.push({ name, description: meta.description || '', path: itemPath, error: yamlError });
        if (!yamlError) seenNames.set(name, itemPath);
      } catch (e) { }
    }
  }
  return skills;
}

export async function getCommandsConfig() {
  const mainConfigPath = getMainConfigPath();
  try {
    const mainConfig: any = await readJson(mainConfigPath);
    if (mainConfig.commands) return mainConfig.commands;
  } catch { }

  const commandsDir = getCommandsDir();
  return await readJson(joinPaths(commandsDir, 'commands.json'), { folders: [commandsDir] });
}

export async function saveCommandsConfig(config: any) {
  const mainConfigPath = getMainConfigPath();
  const mainConfig: any = await readJson(mainConfigPath, {});
  mainConfig.commands = config;
  await writeJson(mainConfigPath, mainConfig);
}

export async function listAvailableCommands() {
  const config = await getCommandsConfig();
  const commands: any[] = [];
  const seenNames = new Map<string, string>();

  for (const folder of config.folders) {
    if (!(await exists(folder))) continue;
    const cmdMdFiles = await findFilesRecursively(folder, ['COMMAND.md']);
    for (const cmdMdPath of cmdMdFiles) {
      const itemPath = getDirname(cmdMdPath);
      try {
        const content = await readText(cmdMdPath);
        const match = content.match(/^---\r?\n([\s\S]*?)\n---/);
        let meta: any = {};
        let yamlError: string | null = null;
        if (match) {
          try {
            meta = yaml.load(match[1]) || {};
          } catch (e: any) {
            yamlError = e.message;
            notifyError('command', cmdMdPath, e.message);
          }
        }
        const name = meta.name || getBasename(itemPath);
        if (seenNames.has(name)) continue;

        commands.push({
          name, description: meta.description || '', parameters: meta.parameters || [],
          example: meta.example || '', path: itemPath, error: yamlError
        });
        if (!yamlError) seenNames.set(name, itemPath);
      } catch (e) { }
    }
  }
  return commands;
}

export async function restoreDefaultCommands() {
  const commandsToRestore = ['hello-command'];
  let allSuccess = true;
  for (const cmd of commandsToRestore) {
    if (!(await restoreCommand(cmd))) allSuccess = false;
  }
  return allSuccess;
}

export async function restoreCommand(commandName: string) {
  const srcDir = joinPaths(getBundledResourcesPath(), 'commands', commandName);
  const destDir = getCommandPath(commandName);
  if (await exists(srcDir)) {
    try {
      await copy(srcDir, destDir, { recursive: true });
      return true;
    } catch (e) {
      console.error(`[Restore] Error copying command ${commandName}:`, e);
      return false;
    }
  }
  return false;
}
