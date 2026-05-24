import {
  copy,
  exists,
  getSkillPath,
  getSkillsDir,
  joinPaths,
  readdir,
  remove,
} from '../../lib/path'
import { getBundledResourcesPath } from './common'
import {
  getSpellConfig,
  listAvailableSpells,
  saveSpellConfig,
} from './spell-installer'

export async function getSkillsConfig() {
  return getSpellConfig('skills', getSkillsDir())
}

export async function saveSkillsConfig(config: any) {
  return saveSpellConfig('skills', config)
}

export async function listAvailableSkills() {
  return listAvailableSpells('skills', getSkillsDir(), 'SKILL.md', false)
}

/**
 * Restore all default skills by copying resources/skills/* → ~/.aynite/skills/
 */
export async function restoreDefaultSkills() {
  const defaultDir = getSkillsDir()
  await saveSkillsConfig({ folders: [defaultDir] })
  return syncBundledSkillsToDir(defaultDir, true)
}

/**
 * Sync a single skill by name from resources/skills/ to ~/.aynite/skills/<name>.
 * Searches recursively under resources/skills/ to find the skill directory.
 */
export async function restoreSkill(skillName: string): Promise<boolean> {
  const srcDir = await findSkillDir(skillName)
  if (!srcDir) return false
  const destDir = getSkillPath(skillName)
  try {
    if (await exists(destDir)) {
      await remove(destDir, { recursive: true })
    }
    await copy(srcDir, destDir, { recursive: true })
    return true
  } catch (e) {
    console.error(`[Restore] Error copying skill "${skillName}":`, e)
    return false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Copy all top-level entries from resources/skills/ to the given destination.
 * When overwrite=false, only copies items that don't already exist.
 */
async function syncBundledSkillsToDir(
  destDir: string,
  overwrite: boolean,
): Promise<boolean> {
  const bundledSkillsDir = joinPaths(getBundledResourcesPath(), 'skills')
  if (!(await exists(bundledSkillsDir))) return true

  let allSuccess = true
  const entries = await readdir(bundledSkillsDir)
  for (const entry of entries) {
    const srcPath = joinPaths(bundledSkillsDir, entry.name)
    const destPath = joinPaths(destDir, entry.name)
    try {
      if (overwrite && (await exists(destPath))) {
        await remove(destPath, { recursive: true })
      }
      if (!(await exists(destPath))) {
        await copy(srcPath, destPath, { recursive: true })
      }
    } catch (e) {
      console.error(`[Restore] Error copying skill "${entry.name}":`, e)
      allSuccess = false
    }
  }
  return allSuccess
}

/**
 * Recursively search for a directory with the given name under resources/skills/.
 */
async function findSkillDir(
  name: string,
  baseDir?: string,
): Promise<string | null> {
  const dir = baseDir ?? joinPaths(getBundledResourcesPath(), 'skills')
  if (!(await exists(dir))) return null

  const entries = await readdir(dir)
  for (const entry of entries) {
    const fullPath = joinPaths(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === name) return fullPath
      const found = await findSkillDir(name, fullPath)
      if (found) return found
    }
  }
  return null
}
