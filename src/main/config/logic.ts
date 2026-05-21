import { app } from 'electron'
import {
  createDefaultAgentConfig,
  DEFAULT_AI_CONFIG,
  DEFAULT_PROVIDER_URLS,
} from '../../lib/constants/ai'
import { DEFAULT_KEYBINDINGS } from '../../lib/constants/keybindings'
import type { MainConfig, WorkspaceConfig } from '../../lib/constants/types'
import {
  PLAYBOOK_WORKSPACE_CONFIG,
  TRADER_WORKSPACE_CONFIG,
  WRITER_WORKSPACE_CONFIG,
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
  getViewConfigDir,
  getViewConfigPath,
  getWelcomeMdPath,
  getWorkspaceDataPath,
  getWorkspaceDir,
  getWorkspacesConfigPath,
  joinPaths,
  readJson,
  remove,
  unlink,
  writeJson,
  writeText,
} from '../../lib/path'
import type { WorkspacesConfig } from '../../lib/types/workspace'
import {
  ensureDefaultPromptFiles,
  getDefaultGlobalPrompts,
  initWorkspaceFolders,
} from '../ai'
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
import { DEFAULT_VIEW_CONFIGS } from './view-configs'

/**
 * Helper to compare versions.
 * Returns true if oldV is lower than newV.
 */
function isLowerVersion(oldV: string, newV: string): boolean {
  try {
    const parse = (v: string) => v.split('-')[0].split('.').map(Number)
    const [maj1, min1, pat1] = parse(oldV)
    const [maj2, min2, pat2] = parse(newV)

    if (maj1 < maj2) return true
    if (maj1 > maj2) return false
    if (min1 < min2) return true
    if (min1 > min2) return false
    if (pat1 < pat2) return true
    if (pat1 > pat2) return false

    // Handle beta suffix (e.g., 1.0.0-beta.5 vs 1.0.0-beta.6)
    if (oldV.includes('beta') && newV.includes('beta')) {
      const b1 = parseInt(oldV.split('beta.')[1] || '0', 10)
      const b2 = parseInt(newV.split('beta.')[1] || '0', 10)
      return b1 < b2
    }
    // beta is lower than stable
    if (oldV.includes('beta') && !newV.includes('beta')) return true
  } catch (_e) {
    return true // Assume lower if parsing fails
  }
  return false
}

export async function initAppFolders() {
  const currentVersion = app.getVersion()
  const baseDir = getAyniteDir()
  const mainConfigPath = getMainConfigPath()

  let shouldWipe = false
  if (await exists(mainConfigPath)) {
    try {
      const config = await readJson(mainConfigPath)
      const configVersion = config.version
      if (!configVersion) {
        shouldWipe = true
      } else if (isLowerVersion(configVersion, currentVersion)) {
        if (currentVersion.includes('beta')) {
          shouldWipe = true
        }
      }
    } catch (_e) {
      shouldWipe = true
    }
  } else if (await exists(baseDir)) {
    // If baseDir exists but config doesn't, it's a broken state
    shouldWipe = true
  }

  if (shouldWipe) {
    console.log(`[Init] Version mismatch or missing. Wiping ${baseDir}...`)
    try {
      await remove(baseDir, { recursive: true, force: true })
    } catch (e) {
      console.error(`[Init] Failed to wipe directory:`, e)
    }
  }

  await ensureDir(baseDir)
  const folders = Object.values(AYNITE_SUBDIRS)
  for (const folder of folders) {
    await ensureDir(joinPaths(baseDir, folder))
  }

  const aiDefault = DEFAULT_AI_CONFIG
  const keybindingsDefault = DEFAULT_KEYBINDINGS

  const configDefault = {
    version: currentVersion,
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
    const wsConfig: WorkspacesConfig = {
      active: 'Aynite Playbook',
      list: ['Aynite Playbook', 'Market Lens', 'The Quill'],
    }
    await writeJson(getWorkspacesConfigPath(), wsConfig)
  }

  const ignorePath = getIgnoreConfigPath()
  if (!(await exists(ignorePath))) {
    await writeText(ignorePath, ignoreDefault)
  }

  await restoreAynitePlaybook()
  await initThemes()

  // Ensure each default workspace has its config and session directory
  const playbookPath = getPlaybookPath()
  const defaultWorkspaces: Array<[string, WorkspaceConfig]> = [
    [
      'Aynite Playbook',
      {
        ...PLAYBOOK_WORKSPACE_CONFIG,
        folders: [playbookPath],
        activeFile: getWelcomeMdPath(),
      },
    ],
    [
      'Market Lens',
      {
        ...TRADER_WORKSPACE_CONFIG,
        folders: [playbookPath],
        activeFile: getWelcomeMdPath(),
      },
    ],
    [
      'The Quill',
      {
        ...WRITER_WORKSPACE_CONFIG,
        folders: [playbookPath],
        activeFile: getWelcomeMdPath(),
      },
    ],
  ]
  for (const [name, config] of defaultWorkspaces) {
    const wsPath = getWorkspaceDataPath(name)
    if (!(await exists(wsPath))) {
      await ensureDir(getWorkspaceDir(name))
      await initWorkspaceFolders(name)
    }
    // Always patch leaf nodes with example file data, whether new or existing
    const existing = (await exists(wsPath)) ? await readJson(wsPath) : null
    if (existing) {
      for (const layout of existing.layouts || []) {
        setExampleTileData(layout.layout, playbookPath)
      }
      await writeJson(wsPath, existing)
    } else {
      for (const layout of config.layouts) {
        setExampleTileData(layout.layout, playbookPath)
      }
      await writeJson(wsPath, config)
    }
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

  // Copy bundled views to ~/.aynite (contains views/ and assets/)
  const bundledDir = joinPaths(getBundledResourcesPath(), 'dist-views')
  if (await exists(bundledDir)) {
    try {
      await copy(bundledDir, baseDir, { recursive: true })
    } catch (e) {
      console.error(`[Init] Error copying bundled views:`, e)
    }
  }

  // Initialize view config files
  await initViewConfigs()
}

/**
 * Initialize view configuration files under ~/.aynite/config/views/[view]/config.json
 */
export async function initViewConfigs() {
  for (const [viewName, config] of Object.entries(DEFAULT_VIEW_CONFIGS)) {
    const configPath = getViewConfigPath(viewName)
    if (!(await exists(configPath))) {
      await ensureDir(getViewConfigDir(viewName))
      await writeJson(configPath, config)
    }
  }
}

export async function loadConfig() {
  const ai = await readJson(getAIConfigPath(), DEFAULT_AI_CONFIG)
  // Repair AI config if lists are missing (data loss recovery)
  if (!ai.providers || !Array.isArray(ai.providers)) {
    ai.providers = DEFAULT_AI_CONFIG.providers
    if (!ai.activeId) ai.activeId = DEFAULT_AI_CONFIG.activeId
  }

  // Normalize provider URLs: fill in defaults for known providers that have no URL set
  if (ai.providers) {
    for (const p of ai.providers) {
      if (!p.baseUrl && DEFAULT_PROVIDER_URLS[p.provider]) {
        p.baseUrl = DEFAULT_PROVIDER_URLS[p.provider]
      }
    }
  }
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

  // Repair agents if lists are missing
  if (!mainConfig.agents?.list || !Array.isArray(mainConfig.agents.list)) {
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
  const mainConfig = {
    ...rest,
    version: app.getVersion(),
    updatedAt: new Date().toISOString(),
  }

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
  await restoreSpell('', 'aynite-playbook', getPlaybookPath(), 'Welcome.md')
  // Ensure example JSON files exist even if the spell restore was skipped
  const srcDir = joinPaths(getBundledResourcesPath(), 'aynite-playbook')
  const destDir = getPlaybookPath()
  const exampleFiles = [
    'canvas-example.json',
    'mindmap-example.json',
    'flow-example.json',
    'diagram-example.json',
    'graph-example.json',
    'datachart-example.json',
    'stockchart-example.json',
    'diff-example.json',
  ]
  for (const file of exampleFiles) {
    const srcPath = joinPaths(srcDir, file)
    const destPath = joinPaths(destDir, file)
    if ((await exists(srcPath)) && !(await exists(destPath))) {
      try {
        await copy(srcPath, destPath)
      } catch (e) {
        console.error(`[Init] Error copying example file ${file}:`, e)
      }
    }
  }
}

const EXAMPLE_FILE_MAP: Record<string, string> = {
  canvas: 'canvas-example.json',
  mindmap: 'mindmap-example.json',
  flow: 'flow-example.json',
  diagram: 'diagram-example.json',
  graph: 'graph-example.json',
  datachart: 'datachart-example.json',
  stockchart: 'stockchart-example.json',
  diff: 'diff-example.json',
}

function setExampleTileData(node: any, playbookPath: string) {
  if (node.type === 'leaf') {
    const exampleFile = node.name ? EXAMPLE_FILE_MAP[node.name] : undefined
    if (exampleFile) {
      node.data = { file: joinPaths(playbookPath, exampleFile) }
    }
  } else if (node.type === 'split' && node.children) {
    for (const child of node.children) {
      setExampleTileData(child, playbookPath)
    }
  }
}
