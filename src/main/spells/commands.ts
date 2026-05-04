import yaml from 'js-yaml';
import { 
  getCommandsDir, 
  getCommandPath, 
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
