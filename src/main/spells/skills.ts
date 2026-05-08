import { getSkillPath, getSkillsDir } from '../../lib/path'
import {
  getSpellConfig,
  listAvailableSpells,
  restoreSpell as restoreBundledSpell,
  restoreDefaultSpells,
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

export async function restoreDefaultSkills() {
  const defaultDir = getSkillsDir()
  await saveSkillsConfig({ folders: [defaultDir] })
  return restoreDefaultSpells(
    'skills',
    ['skill-creator', 'command-creator', 'hello-skill', 'theme-creator'],
    (name) => getSkillPath(name),
  )
}

export async function restoreSkill(skillName: string) {
  return restoreBundledSpell('skills', skillName, getSkillPath(skillName))
}
