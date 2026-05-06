import yaml from 'js-yaml'
import {
  copy,
  exists,
  getBasename,
  getDirname,
  getMainConfigPath,
  joinPaths,
  readJson,
  readText,
  writeJson,
} from '../../lib/path'
import {
  findFilesRecursively,
  getBundledResourcesPath,
  notifyError,
} from './common'

interface SpellMeta {
  name?: string
  description?: string
  parameters?: any[]
  example?: string
  [key: string]: any
}

export interface SpellItem {
  name: string
  description: string
  path: string
  error: string | null
  parameters?: any[]
  example?: string
}

export async function getSpellConfig(configKey: string, defaultDir: string) {
  const mainConfigPath = getMainConfigPath()
  try {
    const mainConfig: any = await readJson(mainConfigPath)
    if (mainConfig[configKey]) return mainConfig[configKey]
  } catch {}

  return await readJson(joinPaths(defaultDir, `${configKey}.json`), {
    folders: [defaultDir],
  })
}

export async function saveSpellConfig(configKey: string, config: any) {
  const mainConfigPath = getMainConfigPath()
  const mainConfig: any = await readJson(mainConfigPath, {})
  mainConfig[configKey] = config
  await writeJson(mainConfigPath, mainConfig)
}

export async function listAvailableSpells(
  configKey: string,
  defaultDir: string,
  mdFileName: string,
  includeExtras: boolean,
) {
  const config = await getSpellConfig(configKey, defaultDir)
  const items: SpellItem[] = []
  const seenNames = new Map<string, string>()

  for (const folder of config.folders) {
    if (!(await exists(folder))) continue
    const mdFiles = await findFilesRecursively(folder, [mdFileName])
    for (const mdPath of mdFiles) {
      const itemPath = getDirname(mdPath)
      try {
        const content = await readText(mdPath)
        const match = content.match(/^---\r?\n([\s\S]*?)\n---/)
        let meta: SpellMeta = {}
        let yamlError: string | null = null
        if (match) {
          try {
            meta = yaml.load(match[1]) || {}
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            yamlError = message
            notifyError(configKey, mdPath, message)
          }
        }
        const name = meta.name || getBasename(itemPath)
        if (seenNames.has(name)) continue

        items.push({
          name,
          description: meta.description || '',
          path: itemPath,
          error: yamlError,
          ...(includeExtras
            ? { parameters: meta.parameters || [], example: meta.example || '' }
            : {}),
        })
        if (!yamlError) seenNames.set(name, itemPath)
      } catch (_e) {}
    }
  }
  return items
}

export async function restoreSpell(
  resourceDir: string,
  spellName: string,
  destDir: string,
  markerFile?: string,
) {
  if (markerFile && (await exists(joinPaths(destDir, markerFile)))) return true
  const srcDir = joinPaths(getBundledResourcesPath(), resourceDir, spellName)
  if (await exists(srcDir)) {
    try {
      await copy(srcDir, destDir, { recursive: true })
      return true
    } catch (e) {
      console.error(`[Restore] Error copying ${resourceDir} ${spellName}:`, e)
      return false
    }
  }
  return false
}

export async function restoreDefaultSpells(
  resourceDir: string,
  spellNames: string[],
  getDestPath: (name: string) => string,
) {
  let allSuccess = true
  for (const name of spellNames) {
    if (!(await restoreSpell(resourceDir, name, getDestPath(name))))
      allSuccess = false
  }
  return allSuccess
}
