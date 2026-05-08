import { contextBridge, ipcRenderer } from 'electron'
import {
  AiChannels,
  AiEventChannels,
  AppEventChannel,
  AppOperationChannel,
  ConfigChannels,
  FileChannels,
  SpellChannels,
  SystemChannels,
  ThemeChannels,
  UpdateChannels,
  WorkspaceChannels,
} from '../lib/constants/ipc-channels'

/**
 * Unified Aynite Bridge
 *
 * This bridge provides the interface between the renderer and main processes.
 * It is organized by domain and only keeps the necessary event listeners.
 */
const aynite = {
  // ── Config ──────────────────────────────────────────────────────────────
  getConfig: (key: string, payload?: any) =>
    ipcRenderer.invoke(ConfigChannels.GET, { key, payload }),
  setConfig: (key: string, payload: any) =>
    ipcRenderer.invoke(ConfigChannels.SET, { key, payload }),

  // ── File operations ─────────────────────────────────────────────────────
  listFolder: (path: string) => ipcRenderer.invoke(FileChannels.LIST, path),
  readFile: (path: string) => ipcRenderer.invoke(FileChannels.READ, path),
  openFile: (path: string) => ipcRenderer.invoke(FileChannels.OPEN, path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke(FileChannels.SAVE, { path, content }),
  createFile: (path: string, isDirectory: boolean) =>
    ipcRenderer.invoke(FileChannels.CREATE, { path, isDirectory }),
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(FileChannels.RENAME, { oldPath, newPath }),
  copyFile: (srcPath: string, destPath: string) =>
    ipcRenderer.invoke(FileChannels.COPY, { srcPath, destPath }),
  deleteFile: (path: string) => ipcRenderer.invoke(FileChannels.DELETE, path),
  getFileInfo: (path: string) => ipcRenderer.invoke(FileChannels.INFO, path),
  refreshWatcher: () => ipcRenderer.invoke(FileChannels.WATCHER_REFRESH),

  // ── Workspace operations ────────────────────────────────────────────────
  getWorkspacesList: () => ipcRenderer.invoke(WorkspaceChannels.LIST),
  createWorkspace: (name: string) =>
    ipcRenderer.invoke(WorkspaceChannels.CREATE, name),
  switchWorkspace: (name: string) =>
    ipcRenderer.invoke(WorkspaceChannels.SWITCH, name),
  addWorkspaceFolder: () => ipcRenderer.invoke(WorkspaceChannels.ADD_FOLDER),
  removeWorkspaceFolder: (path: string) =>
    ipcRenderer.invoke(WorkspaceChannels.FOLDER_REMOVE, path),
  reorderWorkspaceFolders: (folders: string[]) =>
    ipcRenderer.invoke(WorkspaceChannels.FOLDER_REORDER, folders),
  getWorkspaceFolders: () => ipcRenderer.invoke(WorkspaceChannels.FOLDER_LIST),
  workspaceAllFiles: () => ipcRenderer.invoke(WorkspaceChannels.FILE_SCAN),

  // ── AI operations ───────────────────────────────────────────────────────
  aiChat: (payload: any) => ipcRenderer.invoke(AiChannels.CHAT, payload),
  getMergedSystemPrompt: (globalFiles?: string[], agentFiles?: string[]) =>
    ipcRenderer.invoke(AiChannels.PROMPT_GET_MERGED, globalFiles, agentFiles),
  restorePrompts: () => ipcRenderer.invoke(AiChannels.PROMPT_RESTORE),
  listSessions: () => ipcRenderer.invoke(AiChannels.SESSION_LIST),
  saveSession: (sessionId: string, messages: any[]) =>
    ipcRenderer.invoke(AiChannels.SESSION_SAVE, { sessionId, messages }),
  loadSession: (sessionId: string, date: string) =>
    ipcRenderer.invoke(AiChannels.SESSION_LOAD, { sessionId, date }),
  runDirectCommand: (payload: any) =>
    ipcRenderer.invoke(SpellChannels.COMMAND_RUN_DIRECT, payload),
  respondToAiApproval: (id: string, approved: boolean) =>
    ipcRenderer.send(AiEventChannels.APPROVAL_RESPONSE, { id, approved }),

  // ── System ──────────────────────────────────────────────────────────────
  openExternal: (url: string) =>
    ipcRenderer.invoke(SystemChannels.OPEN_EXTERNAL, url),
  getSystemFonts: () => ipcRenderer.invoke(SystemChannels.FONT_LIST),
  getAvailableViews: () => ipcRenderer.invoke(SystemChannels.VIEW_LIST),
  checkForUpdates: () => ipcRenderer.invoke(UpdateChannels.CHECK),
  selectFolder: () => ipcRenderer.invoke(SystemChannels.DIALOG_SELECT_FOLDER),
  selectFile: (options?: any) =>
    ipcRenderer.invoke(SystemChannels.DIALOG_SELECT_FILE, options),
  activateTile: (tileId: string) =>
    ipcRenderer.invoke(SystemChannels.TILE_ACTIVATE, tileId),

  // ── Theme operations ────────────────────────────────────────────────────
  getThemes: () => ipcRenderer.invoke(ThemeChannels.LIST),
  getTheme: (name: string) => ipcRenderer.invoke(ThemeChannels.READ, name),
  deleteTheme: (name: string) => ipcRenderer.invoke(ThemeChannels.DELETE, name),

  // ── Spells ──────────────────────────────────────────────────────────────
  getAvailableSkills: () => ipcRenderer.invoke(SpellChannels.SKILL_LIST),
  getAvailableCommands: () => ipcRenderer.invoke(SpellChannels.COMMAND_LIST),
  pickSkillFolder: () => ipcRenderer.invoke(SpellChannels.SKILL_ADD_FOLDER),
  pickCommandFolder: () => ipcRenderer.invoke(SpellChannels.COMMAND_ADD_FOLDER),
  restoreSkills: () => ipcRenderer.invoke(SpellChannels.SKILL_RESTORE),
  restoreCommands: () => ipcRenderer.invoke(SpellChannels.COMMAND_RESTORE),

  // ── Unified Communication Channels (Listeners) ──────────────────────────

  onAppEvent: (callback: (event: { type: string; data: unknown }) => void) => {
    const listener = (_: any, event: { type: string; data: unknown }) =>
      callback(event)
    ipcRenderer.on(AppEventChannel, listener)
    return () => ipcRenderer.removeListener(AppEventChannel, listener)
  },

  /**
   * Internal app operations listener.
   * Used for operations that should NOT be broadcasted to iframes (e.g. layout actions, keyboard shortcuts).
   */
  onAppOperation: (callback: (operation: string) => void) => {
    const listener = (_: any, operation: string) => {
      callback(operation)
    }
    ipcRenderer.on(AppOperationChannel, listener)
    return () => ipcRenderer.removeListener(AppOperationChannel, listener)
  },

  // ── Utilities ───────────────────────────────────────────────────────────
  joinPath: (...paths: string[]) => paths.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '.',
  platform: process.platform,
}

// ─── Expose bridge ─────────────────────────────────────────────────────────
try {
  contextBridge.exposeInMainWorld('aynite', aynite)
} catch (error) {
  console.error('[Preload] Failed to expose Aynite bridge:', error)
}
