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
import { DEFAULT_WORKSPACE_CONFIG } from '../../lib/constants/workspace'
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
  getWorkspaceDir,
  getWorkspacesConfigPath,
  joinPaths,
  readdir,
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
  restoreSpell,
} from '../spells'
import { initThemes } from '../theme'
import { getIgnorePatterns } from './ignore'

const OLD_DEFAULT_WORKSPACES = ['Aynite Playbook', 'Market Lens', 'The Quill']
const NEW_DEFAULT_WORKSPACE = 'Aynite'

async function getPlaybookPathResolved(): Promise<string> {
  return getPlaybookPath()
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

  const ignorePath = getIgnoreConfigPath()
  if (!(await exists(ignorePath))) {
    await writeText(ignorePath, ignoreDefault)
  }

  await restoreAynitePlaybook()
  await initThemes()

  // ── Migration: Replace old default workspaces with single "Aynite" workspace ──
  const mainConfigData = await readJson<Record<string, unknown>>(
    getMainConfigPath(),
    {},
  )
  const needsMigration = !mainConfigData.migratedV1

  if (needsMigration) {
    console.log(
      '[Init] Running V1 migration: consolidating default workspaces...',
    )
    await migrateDefaultWorkspaces()
    mainConfigData.migratedV1 = true
    await writeJson(getMainConfigPath(), mainConfigData)
  }

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
  }

  // Ensure "Aynite" is in the workspace list and is active
  if (!wsConfig.list.includes(NEW_DEFAULT_WORKSPACE)) {
    wsConfig.list.push(NEW_DEFAULT_WORKSPACE)
  }
  wsConfig.active = NEW_DEFAULT_WORKSPACE
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

/**
 * Migration from old 3-workspace defaults to new single "Aynite" workspace.
 *
 * 1. Reads folders from ALL existing workspaces (user-created + old defaults)
 * 2. Collects all unique folders, excluding the aynite-playbook folder
 * 3. Creates the new "Aynite" workspace with those collected folders
 * 4. Removes only the 3 old default workspaces from the list, preserving user workspaces
 * 5. Deletes old default workspace data directories from disk
 */
async function migrateDefaultWorkspaces() {
  const wsConfig = await readJson<WorkspacesConfig>(getWorkspacesConfigPath(), {
    active: NEW_DEFAULT_WORKSPACE,
    list: [NEW_DEFAULT_WORKSPACE],
  })

  // Collect folders from ALL existing workspaces (not just old defaults)
  const allFolders = new Set<string>()
  const playbookPath = await getPlaybookPathResolved()
  const playbookNormalized = playbookPath.replace(/\/+$/, '')

  for (const wsName of wsConfig.list) {
    // Skip already known default workspaces — they're being removed
    if (OLD_DEFAULT_WORKSPACES.includes(wsName)) continue

    const wsPath = getWorkspaceDataPath(wsName)
    if (await exists(wsPath)) {
      try {
        const data = await readJson<WorkspaceConfig>(wsPath)
        if (data.folders) {
          for (const folder of data.folders) {
            // Exclude the aynite-playbook folder
            const normalized = folder.replace(/\/+$/, '')
            if (normalized !== playbookNormalized) {
              allFolders.add(folder)
            }
          }
        }
      } catch (e) {
        console.error(`[Init] Error reading workspace ${wsName}:`, e)
      }
    }
  }

  // Also collect folders from the old default workspaces (they're about to be deleted)
  for (const oldName of OLD_DEFAULT_WORKSPACES) {
    if (!wsConfig.list.includes(oldName)) continue
    const wsPath = getWorkspaceDataPath(oldName)
    if (await exists(wsPath)) {
      try {
        const data = await readJson<WorkspaceConfig>(wsPath)
        if (data.folders) {
          for (const folder of data.folders) {
            const normalized = folder.replace(/\/+$/, '')
            if (normalized !== playbookNormalized) {
              allFolders.add(folder)
            }
          }
        }
      } catch (e) {
        console.error(`[Init] Error reading workspace ${oldName}:`, e)
      }
    }
  }

  // Create the new "Aynite" workspace with all collected folders
  const ayniteWsPath = getWorkspaceDataPath(NEW_DEFAULT_WORKSPACE)
  await ensureDir(getWorkspaceDir(NEW_DEFAULT_WORKSPACE))
  await initWorkspaceFolders(NEW_DEFAULT_WORKSPACE)
  await writeJson(ayniteWsPath, {
    ...DEFAULT_WORKSPACE_CONFIG,
    id: NEW_DEFAULT_WORKSPACE,
    folders: [...allFolders],
  })

  // Remove only the old default workspaces from the list (preserve user workspaces)
  wsConfig.list = wsConfig.list.filter(
    (w) => !OLD_DEFAULT_WORKSPACES.includes(w),
  )

  // Ensure "Aynite" is in the list and is active
  if (!wsConfig.list.includes(NEW_DEFAULT_WORKSPACE)) {
    wsConfig.list.push(NEW_DEFAULT_WORKSPACE)
  }
  wsConfig.active = NEW_DEFAULT_WORKSPACE
  await writeJson(getWorkspacesConfigPath(), wsConfig)

  // Clean up old default workspace data directories from disk
  for (const oldName of OLD_DEFAULT_WORKSPACES) {
    const oldDir = getWorkspaceDir(oldName)
    if (await exists(oldDir)) {
      try {
        await remove(oldDir, { recursive: true, force: true })
        console.log(`[Init] Removed old workspace data: ${oldDir}`)
      } catch (e) {
        console.error(`[Init] Error removing workspace directory ${oldDir}:`, e)
      }
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
