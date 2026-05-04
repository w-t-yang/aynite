import { app } from 'electron';
import { joinPaths, readdir, getAbsolutePath } from '../../lib/path';

export let notificationCallback: ((data: { type: 'skill' | 'command', path: string, error: string }) => void) | null = null;
export let reportedErrors = new Map<string, string>();

export function setSpellsNotificationCallback(cb: typeof notificationCallback) {
  notificationCallback = cb;
}

export function notifyError(type: 'skill' | 'command', path: string, error: string) {
  if (reportedErrors.get(path) === error) return;
  reportedErrors.set(path, error);
  if (notificationCallback) notificationCallback({ type, path, error });
}

export function getBundledResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  } else {
    return joinPaths(process.cwd(), 'resources');
  }
}

export async function findFilesRecursively(dir: string, filenames: string[], ignoreDirs: string[] = ['node_modules', '.git']): Promise<string[]> {
  let results: string[] = [];
  try {
    const list = await readdir(dir);
    for (const file of list) {
      const res = getAbsolutePath(file.name, dir);
      if (file.isDirectory()) {
        if (ignoreDirs.includes(file.name)) continue;
        results = results.concat(await findFilesRecursively(res, filenames, ignoreDirs));
      } else if (filenames.includes(file.name)) {
        results.push(res);
      }
    }
  } catch (e) { }
  return results;
}
