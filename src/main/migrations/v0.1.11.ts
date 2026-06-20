/**
 * Migration v0.1.11
 *
 * Injects system layouts (Home, Projects, Settings) into existing workspace configs.
 * These are fixed, immutable layouts that replace the old single "Default" layout.
 * Existing user-created layouts are preserved after the system layouts.
 */
import { SYSTEM_LAYOUTS } from '../../lib/constants/layout'
import {
  exists,
  getWorkspaceDataPath,
  readJson,
  writeJson,
} from '../../lib/path'

const NEW_DEFAULT_WORKSPACE = 'Aynite'

export const version = '0.1.11'

export async function migrate(): Promise<void> {
  const ayniteWsPath = getWorkspaceDataPath(NEW_DEFAULT_WORKSPACE)

  if (!(await exists(ayniteWsPath))) {
    console.log('[migration v0.1.11] No Aynite workspace found, skipping.')
    return
  }

  const existingData = await readJson<Record<string, unknown>>(ayniteWsPath, {})
  if (!existingData || typeof existingData !== 'object') {
    console.log('[migration v0.1.11] Invalid workspace data, skipping.')
    return
  }

  const existingLayouts = (existingData as any).layouts
  if (!Array.isArray(existingLayouts)) {
    console.log('[migration v0.1.11] No layouts array found, skipping.')
    return
  }

  const hasSystemLayouts = existingLayouts.some((l: any) => l.system === true)
  if (hasSystemLayouts) {
    console.log('[migration v0.1.11] System layouts already present, skipping.')
    return
  }

  console.log(
    '[migration v0.1.11] Injecting system layouts into Aynite workspace...',
  )

  // Remove the old default layout if present
  const userLayouts = existingLayouts.filter(
    (l: any) => l.id !== 'aynite-default',
  )

  ;(existingData as any).layouts = [...SYSTEM_LAYOUTS, ...userLayouts]
  ;(existingData as any).activeLayoutId = SYSTEM_LAYOUTS[0].id
  await writeJson(ayniteWsPath, existingData)

  console.log('[migration v0.1.11] System layouts injected successfully.')
}
