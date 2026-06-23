import { homedir, userInfo } from 'node:os'
import { app } from 'electron'
import {
  AGENT_IDS,
  createDefaultAgents,
  DEFAULT_AI_CONFIG,
  DEFAULT_PROVIDER_URLS,
} from '../../lib/constants/ai'
import { DEFAULT_KEYBINDINGS } from '../../lib/constants/keybindings'
import type { MainConfig } from '../../lib/constants/types'

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
import { DEFAULT_WORKSPACE_CONFIG } from '../../lib/constants/workspace'
import {
  AYNITE_SUBDIRS,
  copy,
  ensureDir,
  exists,
  getAgentPath,
  getAgentsDir,
  getAIConfigPath,
  getAppearanceConfigPath,
  getAyniteDir,
  getAynitePromptPath,
  getIgnoreConfigPath,
  getKeybindingsConfigPath,
  getMainConfigPath,
  getPlaybookPath,
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
import { runMigrations } from '../migrations'
import {
  getBundledResourcesPath,
  getCommandsConfig,
  getSkillsConfig,
  restoreCommand,
  restoreSpell,
} from '../spells'
import { initThemes } from '../theme'
import { getIgnorePatterns } from './ignore'

const NEW_DEFAULT_WORKSPACE = 'Aynite'

/**
 * Ensures the two default agents (Aynite + Assistant) exist as individual files
 * in ~/.aynite/agents/<id>.json, and deletes any other agent files.
 * Also cleans up the old config.json agents.list format if present.
 */
async function migrateAgentsToFiles() {
  const mainConfig = await readJson<MainConfig>(getMainConfigPath(), {})
  const agentsDir = getAgentsDir()
  await ensureDir(agentsDir)

  // Check if we already have agent files (migration already done)
  const existingFiles = await readdir(agentsDir).catch(() => [])
  const existingAgentIds = new Set(
    existingFiles
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name.replace(/\.json$/, '')),
  )

  const globalPromptFiles = mainConfig.prompts?.files || []
  const userName = userInfo().username

  // Create default agents if they don't exist
  const defaultAgents = createDefaultAgents(
    (filename: string) => getAynitePromptPath(filename),
    userName,
    globalPromptFiles,
  )

  for (const agent of defaultAgents) {
    if (!existingAgentIds.has(agent.id)) {
      await writeJson(getAgentPath(agent.id), agent)
      existingAgentIds.add(agent.id)
    }
  }

  // Clean up old agents field from config.json
  if (mainConfig.agents) {
    const defaultAgentId =
      mainConfig.defaultAgentId ||
      mainConfig.agents?.activeId ||
      AGENT_IDS.AYNITE
    delete mainConfig.agents
    mainConfig.defaultAgentId = defaultAgentId
    await writeJson(getMainConfigPath(), mainConfig)
  }
}

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
    skills: {
      folders: [
        joinPaths(baseDir, AYNITE_SUBDIRS.SKILLS),
        joinPaths(homedir(), '.agents', 'skills'),
        joinPaths(homedir(), '.claude', 'skills'),
      ],
    },
    commands: { folders: [joinPaths(baseDir, AYNITE_SUBDIRS.COMMANDS)] },
    prompts: { files: getDefaultGlobalPrompts() },
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

  const ignorePath = getIgnoreConfigPath()
  if (!(await exists(ignorePath))) {
    await writeText(ignorePath, ignoreDefault)
  }

  await restoreAynitePlaybook()
  await initThemes()

  // ── Run all pending data migrations ──
  await runMigrations()

  // ── Migrate agents from config.json to individual files ──
  await migrateAgentsToFiles()

  // ── Fresh install: create "Aynite" workspace if it doesn't exist ──
  const wsConfig = await readJson<WorkspacesConfig>(getWorkspacesConfigPath(), {
    active: NEW_DEFAULT_WORKSPACE,
    list: [NEW_DEFAULT_WORKSPACE],
  })

  const ayniteWsPath = getWorkspaceDataPath(NEW_DEFAULT_WORKSPACE)
  if (!(await exists(ayniteWsPath))) {
    console.log('[Init] Creating Aynite workspace...')
    await ensureDir(getWorkspaceDir(NEW_DEFAULT_WORKSPACE))
    await initWorkspaceFolders(NEW_DEFAULT_WORKSPACE)
    await writeJson(ayniteWsPath, {
      ...DEFAULT_WORKSPACE_CONFIG,
      id: NEW_DEFAULT_WORKSPACE,
    })
    // Fresh install: set as active workspace
    wsConfig.active = NEW_DEFAULT_WORKSPACE
  }

  // Ensure "Aynite" is in the workspace list
  if (!wsConfig.list.includes(NEW_DEFAULT_WORKSPACE)) {
    wsConfig.list.push(NEW_DEFAULT_WORKSPACE)
  }
  // Only set active on fresh install — don't overwrite saved workspace choice
  await writeJson(getWorkspacesConfigPath(), wsConfig)

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
    for (const p of ai.providers as any[]) {
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
  // Ensure default and cross-app skill directories are included.
  // listAvailableSpells handles non-existent folders gracefully,
  // so we add them unconditionally without checking exists().
  const requiredSkillDirs = [
    joinPaths(getAyniteDir(), AYNITE_SUBDIRS.SKILLS),
    joinPaths(homedir(), '.agents', 'skills'),
    joinPaths(homedir(), '.claude', 'skills'),
  ]
  let skillsModified = false
  if (mainConfig.skills?.folders) {
    for (const dir of requiredSkillDirs) {
      if (!mainConfig.skills.folders.includes(dir)) {
        mainConfig.skills.folders.push(dir)
        skillsModified = true
      }
    }
  }
  if (skillsModified) {
    await writeJson(getMainConfigPath(), mainConfig)
  }
  if (!mainConfig.commands) mainConfig.commands = await getCommandsConfig()
  if (!mainConfig.telemetry) mainConfig.telemetry = { enabled: true }
  if (mainConfig.prompts?.files) {
    mainConfig.prompts.files = mainConfig.prompts.files.filter((f: string) => {
      const filename = f.split('/').pop()
      return filename ? !filename.startsWith('agent-') : true
    })
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
