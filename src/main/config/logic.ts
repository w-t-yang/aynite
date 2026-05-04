import { app } from 'electron';
import { DEFAULT_KEYBINDINGS } from '../../lib/constants/keybindings';
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
  getPlaybookPath,
  getWelcomeMdPath,
  joinPaths,
  ensureDir, 
  readJson, 
  writeJson, 
  readText, 
  writeText,
  exists,
  unlink,
  copy,
  AYNITE_SUBDIRS
} from '../../lib/path';
import { getDefaultGlobalPrompts, restoreDefaultPrompts } from '../ai';
import { 
  DEFAULT_AI_CONFIG, 
  AGENT_PROMPTS, 
  DEFAULT_AGENTS
} from '../../lib/constants/ai';
import { initThemes } from '../theme';
import { restoreSkill, restoreCommand, getSkillsConfig, getCommandsConfig, setSpellsNotificationCallback } from '../spells';

import { 
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_CONFIG 
} from '../../lib/constants/workspace';

let notificationCallback: ((data: { type: 'skill' | 'command', path: string, error: string }) => void) | null = null;

export function setConfigNotificationCallback(cb: typeof notificationCallback) {
  notificationCallback = cb;
  setSpellsNotificationCallback(cb);
}

export { getAyniteDir, expandHome };

export function getBundledResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  } else {
    return joinPaths(process.cwd(), 'resources');
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

  const configDefault = {
    lastUsed: new Date().toISOString(),
    activeTheme: 'light',
    skills: { folders: [joinPaths(baseDir, AYNITE_SUBDIRS.SKILLS)] },
    commands: { folders: [joinPaths(baseDir, AYNITE_SUBDIRS.COMMANDS)] },
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
  const workspacesDefault = { active: DEFAULT_WORKSPACE_ID, list: [DEFAULT_WORKSPACE_ID] };

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

  // Initialize workspaces.json if missing
  const workspacesJsonPath = getWorkspacesConfigPath();
  if (!(await exists(workspacesJsonPath))) {
    await writeJson(workspacesJsonPath, workspacesDefault);
  }

  // Ensure default workspace config exists
  const defaultWorkspacePath = getWorkspaceDataPath(DEFAULT_WORKSPACE_ID);
  if (!(await exists(defaultWorkspacePath))) {
    const playbookPath = getPlaybookPath();
    // Add playbook to default folders if it's the first time
    const initialConfig = { 
      ...DEFAULT_WORKSPACE_CONFIG, 
      id: DEFAULT_WORKSPACE_ID,
      folders: [playbookPath] 
    };
    await writeJson(defaultWorkspacePath, initialConfig);
  }

  // Ensure default skills/commands


  // Ensure default skills/commands
  for (const skillName of ['skill-creator', 'command-creator', 'hello-skill', 'theme-creator']) {
    if (!(await exists(joinPaths(baseDir, AYNITE_SUBDIRS.SKILLS, skillName)))) {
      await restoreSkill(skillName);
    }
  }
  for (const cmdName of ['hello-command']) {
    if (!(await exists(joinPaths(baseDir, AYNITE_SUBDIRS.COMMANDS, cmdName)))) {
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
    // @ts-ignore
    mainConfig.prompts.files = mainConfig.prompts.files.filter((f: string) => !f.split('/').pop().startsWith('agent-'));
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
