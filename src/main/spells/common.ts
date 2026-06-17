import { app } from 'electron'
import { AppEvents } from '../../lib/constants/app'
import { reportedErrors } from '../../lib/constants/spells'
import { getAbsolutePath, joinPaths, readdir } from '../../lib/path'
import { broadcastAppEvent } from '../ipc-utils'

export { reportedErrors }

export function notifyError(
  type: 'skill' | 'command',
  path: string,
  error: string,
) {
  if (reportedErrors.get(path) === error) return
  reportedErrors.set(path, error)

  broadcastAppEvent(AppEvents.CONFIG_ERROR, { type, path, error })
}

export function getBundledResourcesPath(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  } else {
    return joinPaths(process.cwd(), 'resources')
  }
}

export async function findFilesRecursively(
  dir: string,
  filenames: string[],
  ignoreDirs: string[] = ['node_modules', '.git'],
): Promise<string[]> {
  let results: string[] = []
  try {
    const list = await readdir(dir)
    for (const file of list) {
      const res = getAbsolutePath(file.name, dir)
      if (file.isDirectory()) {
        if (ignoreDirs.includes(file.name)) continue
        results = results.concat(
          await findFilesRecursively(res, filenames, ignoreDirs),
        )
      } else if (filenames.includes(file.name)) {
        results.push(res)
      }
    }
  } catch (_e) {}
  return results
}
