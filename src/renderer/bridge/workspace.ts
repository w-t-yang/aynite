/**
 * Bridge module: Workspace operations
 *
 * Typed getters and setters for workspace management.
 * Setters return Promise<void> — workspace-changed events update views.
 */

import type { WorkspacesConfig } from '../../lib/types/workspace'

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

// ── Getters (return data) ────────────────────────────────────────────

export const workspace = {
  list: (): Promise<WorkspacesConfig> => getAynite().getWorkspacesList(),

  folders: (): Promise<string[]> => getAynite().getWorkspaceFolders(),

  allFiles: (): Promise<FileEntry[]> => getAynite().workspaceAllFiles(),
}

// ── Setters (return void — state changes come through events) ────────

export const workspaceMutations = {
  create: (name: string): Promise<void> =>
    getAynite()
      .createWorkspace(name)
      .then(() => {}),

  delete: (name: string): Promise<void> =>
    getAynite()
      .deleteWorkspace(name)
      .then(() => {}),

  switch: (name: string): Promise<void> =>
    getAynite()
      .switchWorkspace(name)
      .then(() => {}),

  addFolder: (): Promise<string | null> => getAynite().addWorkspaceFolder(),

  removeFolder: (path: string): Promise<boolean> =>
    getAynite().removeWorkspaceFolder(path),

  reorderFolders: (folders: string[]): Promise<boolean> =>
    getAynite().reorderWorkspaceFolders(folders),
}
