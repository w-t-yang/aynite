import yaml from 'js-yaml';
import { 
  getSkillsDir, 
  getSkillPath, 
  getBasename, 
  getDirname, 
  joinPaths, 
  readText, 
  exists, 
  copy, 
  readJson, 
  getMainConfigPath, 
  writeJson 
} from '../../lib/path';
import { getBundledResourcesPath, notifyError, findFilesRecursively } from './common';

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

export async function restoreDefaultSkills() {
  const skillsToRestore = ['skill-creator', 'command-creator', 'hello-skill'];
  let allSuccess = true;
  for (const skill of skillsToRestore) {
    if (!(await restoreSkill(skill))) allSuccess = false;
  }
  return allSuccess;
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
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            yamlError = message;
            notifyError('skill', skillMdPath, message);
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
