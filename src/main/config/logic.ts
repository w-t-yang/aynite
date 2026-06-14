import { app } from 'electron'
import {
  createDefaultAgentConfig,
  DEFAULT_AI_CONFIG,
  DEFAULT_PROVIDER_URLS,
} from '../../lib/constants/ai'
import { DEFAULT_KEYBINDINGS } from '../../lib/constants/keybindings'
import type { MainConfig, WorkspaceConfig } from '../../lib/constants/types'

/**
 * Detect the user's preferred language from the Electron app locale.
 * Returns 'zh' if the locale starts with 'zh', otherwise 'en'.
 */
function detectSystemLanguage(): string {
  const locale = app.getLocale()
  return locale.startsWith('zh') ? 'zh' : 'en'
}

// View configs are bundled with each view as config.json and copied
// to ~/.aynite/views/<view>/config.json during dist-views sync
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
  getAynitePath,
  getAynitePromptPath,
  getIgnoreConfigPath,
  getKeybindingsConfigPath,
  getMainConfigPath,
  getPlaybookPath,
  getWelcomeMdPath,
  getWorkspaceDataPath,
  getWorkspaceDir,
  getWorkspacesConfigPath,
  joinPaths,
  readdir,
  readJson,
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
  restoreSpell,
} from '../spells'
import { initThemes } from '../theme'
import { getIgnorePatterns } from './ignore'

export async function initAppFolders() {
  const currentVersion = app.getVersion()
  const baseDir = getAyniteDir()

  await ensureDir(baseDir)
  const folders = Object.values(AYNITE_SUBDIRS)
  for (const folder of folders) {
    await ensureDir(joinPaths(baseDir, folder))
  }

  const aiDefault = DEFAULT_AI_CONFIG
  const keybindingsDefault = DEFAULT_KEYBINDINGS

  const systemLanguage = detectSystemLanguage()
  const configDefault = {
    version: currentVersion,
    lastUsed: new Date().toISOString(),
    activeTheme: 'light',
    language: systemLanguage,
    skills: { folders: [joinPaths(baseDir, AYNITE_SUBDIRS.SKILLS)] },
    commands: { folders: [joinPaths(baseDir, AYNITE_SUBDIRS.COMMANDS)] },
    prompts: { files: getDefaultGlobalPrompts() },
    agents: createDefaultAgentConfig(getAynitePromptPath),
    telemetry: { enabled: true },
  }
  const ignoreDefault = [
    'node_modules',
    '.DS_Store',
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
        folders: [playbookPath, getAynitePath('rss'), getAynitePath('spotify')],
        activeFile: getWelcomeMdPath(),
      },
    ],
    [
      'Market Lens',
      {
        ...TRADER_WORKSPACE_CONFIG,
        folders: [playbookPath],
        activeFile: joinPaths(playbookPath, 'trading', 'README.md'),
      },
    ],
    [
      'The Quill',
      {
        ...WRITER_WORKSPACE_CONFIG,
        folders: [playbookPath],
        activeFile: joinPaths(playbookPath, 'writing', 'README.md'),
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
      // Also update activeFile for default workspaces so changes take effect on existing installs
      if (name === 'Market Lens') {
        existing.activeFile = joinPaths(playbookPath, 'trading', 'README.md')
      } else if (name === 'The Quill') {
        existing.activeFile = joinPaths(playbookPath, 'writing', 'README.md')
      }
      await writeJson(wsPath, existing)
    } else {
      for (const layout of config.layouts) {
        setExampleTileData(layout.layout, playbookPath)
      }
      await writeJson(wsPath, config)
    }
  }

  // Sync bundled skills to ~/.aynite/skills/ (only missing items)
  const bundledSkillsDir = joinPaths(getBundledResourcesPath(), 'skills')
  if (await exists(bundledSkillsDir)) {
    const entries = await readdir(bundledSkillsDir)
    for (const entry of entries) {
      const destPath = joinPaths(baseDir, AYNITE_SUBDIRS.SKILLS, entry.name)
      if (!(await exists(destPath))) {
        await copy(joinPaths(bundledSkillsDir, entry.name), destPath, {
          recursive: true,
        })
      }
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
  if (!mainConfig.telemetry) mainConfig.telemetry = { enabled: true }
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
    language: mainConfig.language || detectSystemLanguage(),
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
