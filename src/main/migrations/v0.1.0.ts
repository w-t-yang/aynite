/**
 * Migration v0.1.0
 *
 * Consolidates the 3 old default workspaces ("Aynite Playbook", "Market Lens", "The Quill")
 * into a single "Aynite" workspace. Collects all user folders from the old workspaces
 * (excluding the aynite-playbook folder) and creates the new workspace with them.
 * Then removes the old default workspaces from the list and deletes their data directories.
 */
import type { WorkspaceConfig } from '../../lib/constants/types'
import { DEFAULT_WORKSPACE_CONFIG } from '../../lib/constants/workspace'
import {
  ensureDir,
  exists,
  getPlaybookPath,
  getWorkspaceDataPath,
  getWorkspaceDir,
  getWorkspacesConfigPath,
  readJson,
  remove,
  writeJson,
} from '../../lib/path'
import type { WorkspacesConfig } from '../../lib/types/workspace'
import { initWorkspaceFolders } from '../ai'

const OLD_DEFAULT_WORKSPACES = ['Aynite Playbook', 'Market Lens', 'The Quill']
const NEW_DEFAULT_WORKSPACE = 'Aynite'

export const version = '0.1.0'

export async function migrate(): Promise<void> {
  const wsConfig = await readJson<WorkspacesConfig>(getWorkspacesConfigPath(), {
    active: NEW_DEFAULT_WORKSPACE,
    list: [NEW_DEFAULT_WORKSPACE],
  })

  // Collect folders from all existing workspaces
  const allFolders = new Set<string>()
  const playbookPath = getPlaybookPath()
  const playbookNormalized = playbookPath.replace(/\/+$/, '')

  for (const wsName of wsConfig.list) {
    if (OLD_DEFAULT_WORKSPACES.includes(wsName)) continue
    const wsPath = getWorkspaceDataPath(wsName)
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
        console.error(
          `[migration v0.1.0] Error reading workspace ${wsName}:`,
          e,
        )
      }
    }
  }

  // Collect folders from old default workspaces (about to be deleted)
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
        console.error(
          `[migration v0.1.0] Error reading old workspace ${oldName}:`,
          e,
        )
      }
    }
  }

  // Create the new "Aynite" workspace
  const ayniteWsPath = getWorkspaceDataPath(NEW_DEFAULT_WORKSPACE)
  await ensureDir(getWorkspaceDir(NEW_DEFAULT_WORKSPACE))
  await initWorkspaceFolders(NEW_DEFAULT_WORKSPACE)
  await writeJson(ayniteWsPath, {
    ...DEFAULT_WORKSPACE_CONFIG,
    id: NEW_DEFAULT_WORKSPACE,
    folders: [...allFolders],
  })

  // Remove old default workspaces from list, preserve user workspaces
  wsConfig.list = wsConfig.list.filter(
    (w) => !OLD_DEFAULT_WORKSPACES.includes(w),
  )
  if (!wsConfig.list.includes(NEW_DEFAULT_WORKSPACE)) {
    wsConfig.list.push(NEW_DEFAULT_WORKSPACE)
  }
  wsConfig.active = NEW_DEFAULT_WORKSPACE
  await writeJson(getWorkspacesConfigPath(), wsConfig)

  // Delete old workspace data directories
  for (const oldName of OLD_DEFAULT_WORKSPACES) {
    const oldDir = getWorkspaceDir(oldName)
    if (await exists(oldDir)) {
      try {
        await remove(oldDir, { recursive: true, force: true })
        console.log(`[migration v0.1.0] Removed old workspace data: ${oldDir}`)
      } catch (e) {
        console.error(
          `[migration v0.1.0] Error removing workspace directory ${oldDir}:`,
          e,
        )
      }
    }
  }

  console.log('[migration v0.1.0] Workspace consolidation complete.')
}
