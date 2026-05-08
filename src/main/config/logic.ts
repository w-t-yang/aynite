import {
  createDefaultAgentConfig,
  DEFAULT_AI_CONFIG,
} from '../../lib/constants/ai'
import { DEFAULT_KEYBINDINGS } from '../../lib/constants/keybindings'
import type { MainConfig } from '../../lib/constants/types'
import {
  DEFAULT_WORKSPACE_CONFIG,
  DEFAULT_WORKSPACE_ID,
} from '../../lib/constants/workspace'
import {
  AYNITE_SUBDIRS,
  copy,
  ensureDir,
  exists,
  getAIConfigPath,
  getAppearanceConfigPath,
  getAyniteDir,
  getAynitePromptPath,
  getIgnoreConfigPath,
  getKeybindingsConfigPath,
  getMainConfigPath,
  getPlaybookPath,
  getWorkspaceDataPath,
  getWorkspacesConfigPath,
  joinPaths,
  readJson,
  unlink,
  writeJson,
  writeText,
} from '../../lib/path'
import { getDefaultGlobalPrompts } from '../ai'
import {
  getBundledResourcesPath,
  getCommandsConfig,
  getSkillsConfig,
  restoreCommand,
  restoreSkill,
  restoreSpell,
} from '../spells'
import { initThemes } from '../theme'
import { getIgnorePatterns } from './ignore'

export async function initAppFolders() {
  const baseDir = getAyniteDir()
  const folders = Object.values(AYNITE_SUBDIRS)
  for (const folder of folders) {
    await ensureDir(joinPaths(baseDir, folder))
  }

  const aiDefault = DEFAULT_AI_CONFIG
  const keybindingsDefault = DEFAULT_KEYBINDINGS

  const configDefault = {
    lastUsed: new Date().toISOString(),
    activeTheme: 'light',
    skills: { folders: [joinPaths(baseDir, AYNITE_SUBDIRS.SKILLS)] },
    commands: { folders: [joinPaths(baseDir, AYNITE_SUBDIRS.COMMANDS)] },
    prompts: { files: getDefaultGlobalPrompts() },
    agents: createDefaultAgentConfig(getAynitePromptPath),
  }
  const ignoreDefault = [
    'node_modules',
    '.DS_Store',
    'dist',
    'build',
    'out',
    'target',
    'vendor',
    'venv',
  ].join('\n')
  const workspacesDefault = {
    active: DEFAULT_WORKSPACE_ID,
    list: [DEFAULT_WORKSPACE_ID],
  }

  if (!(await exists(getAIConfigPath()))) {
    await writeJson(getAIConfigPath(), aiDefault)
  }
  if (!(await exists(getKeybindingsConfigPath()))) {
    await writeJson(getKeybindingsConfigPath(), keybindingsDefault)
  }
  if (!(await exists(getMainConfigPath()))) {
    await writeJson(getMainConfigPath(), configDefault)
  }
  if (!(await exists(getWorkspacesConfigPath()))) {
    await writeJson(getWorkspacesConfigPath(), workspacesDefault)
  }

  const ignorePath = getIgnoreConfigPath()
  if (!(await exists(ignorePath))) {
    await writeText(ignorePath, ignoreDefault)
  }

  await restoreAynitePlaybook()
  await initThemes()

  // Initialize workspaces.json if missing
  const workspacesJsonPath = getWorkspacesConfigPath()
  if (!(await exists(workspacesJsonPath))) {
    await writeJson(workspacesJsonPath, workspacesDefault)
  }

  // Ensure default workspace config exists
  const defaultWorkspacePath = getWorkspaceDataPath(DEFAULT_WORKSPACE_ID)
  if (!(await exists(defaultWorkspacePath))) {
    const playbookPath = getPlaybookPath()
    // Add playbook to default folders if it's the first time
    const initialConfig = {
      ...DEFAULT_WORKSPACE_CONFIG,
      id: DEFAULT_WORKSPACE_ID,
      folders: [playbookPath],
    }
    await writeJson(defaultWorkspacePath, initialConfig)
  }

  // Ensure default skills/commands
  for (const skillName of [
    'skill-creator',
    'command-creator',
    'hello-skill',
    'theme-creator',
  ]) {
    if (!(await exists(joinPaths(baseDir, AYNITE_SUBDIRS.SKILLS, skillName)))) {
      await restoreSkill(skillName)
    }
  }
  for (const cmdName of ['hello-command']) {
    if (!(await exists(joinPaths(baseDir, AYNITE_SUBDIRS.COMMANDS, cmdName)))) {
      await restoreCommand(cmdName)
    }
  }

  await ensureDefaultPromptFiles()

  // Copy bundled views to ~/.aynite/views
  const bundledViewsDir = joinPaths(
    getBundledResourcesPath(),
    'renderer',
    'views',
  )
  const targetViewsDir = joinPaths(baseDir, AYNITE_SUBDIRS.VIEWS)
  if (await exists(bundledViewsDir)) {
    try {
      await copy(bundledViewsDir, targetViewsDir, { recursive: true })
    } catch (e) {
      console.error(`[Init] Error copying bundled views:`, e)
    }
  }
}

export async function loadConfig() {
  const ai = await readJson(getAIConfigPath(), {
    provider: 'gemini',
    configs: {},
  })
  const keybindings = await readJson(
    getKeybindingsConfigPath(),
    DEFAULT_KEYBINDINGS,
  )
  const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})

  let modified = false
  const ensureKeys = (target: any, defaults: any) => {
    for (const key in defaults) {
      if (target[key] === undefined) {
        target[key] = JSON.parse(JSON.stringify(defaults[key]))
        modified = true
      } else if (typeof defaults[key] === 'object' && defaults[key] !== null) {
        if (typeof target[key] !== 'object' || target[key] === null) {
          target[key] = JSON.parse(JSON.stringify(defaults[key]))
          modified = true
        } else {
          ensureKeys(target[key], defaults[key])
        }
      }
    }
  }

  ensureKeys(keybindings, DEFAULT_KEYBINDINGS)
  if (modified) {
    await writeJson(getKeybindingsConfigPath(), keybindings)
  }

  if (!mainConfig.skills) mainConfig.skills = await getSkillsConfig()
  if (!mainConfig.commands) mainConfig.commands = await getCommandsConfig()
  if (mainConfig.prompts?.files) {
    mainConfig.prompts.files = mainConfig.prompts.files.filter((f: string) => {
      const filename = f.split('/').pop()
      return filename ? !filename.startsWith('agent-') : true
    })
  }
  if (!mainConfig.agents) {
    mainConfig.agents = createDefaultAgentConfig(getAynitePromptPath)
  }

  const appearancePath = getAppearanceConfigPath()
  if (await exists(appearancePath)) {
    try {
      const appearance = await readJson(appearancePath)
      if (appearance.theme && !mainConfig.activeTheme)
        mainConfig.activeTheme = appearance.theme
      await unlink(appearancePath)
    } catch {}
  }

  const { ignore: _, ...restConfig } = mainConfig
  return {
    activeTheme: mainConfig.activeTheme || 'light',
    ignore: await getIgnorePatterns(),
    keybindings: keybindings,
    ai: ai,
    ...restConfig,
  }
}

export async function saveConfig(settings: any) {
  const {
    ai = DEFAULT_AI_CONFIG,
    keybindings = DEFAULT_KEYBINDINGS,
    ignore,
    ...rest
  } = settings
  const mainConfig = { ...rest, updatedAt: new Date().toISOString() }

  await writeJson(getAIConfigPath(), ai)
  await writeJson(getKeybindingsConfigPath(), keybindings)
  await writeJson(getMainConfigPath(), mainConfig)

  if (ignore !== undefined) {
    await writeText(
      getIgnoreConfigPath(),
      Array.isArray(ignore) ? ignore.join('\n') : ignore,
    )
  }
  return true
}

async function restoreAynitePlaybook() {
  return restoreSpell('', 'aynite-playbook', getPlaybookPath(), 'Welcome.md')
}
