import { contextBridge, ipcRenderer } from 'electron'
import {
  AiChannels,
  AiEventChannels,
  AppEventChannel,
  AppOperationChannel,
  ConfigChannels,
  FileChannels,
  GitChannels,
  RssChannels,
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
  checkIsTextFile: (path: string) =>
    ipcRenderer.invoke(FileChannels.CHECK_TEXT, path),
  refreshWatcher: () => ipcRenderer.invoke(FileChannels.WATCHER_REFRESH),

  // ── Workspace operations ────────────────────────────────────────────────
  getWorkspacesList: () => ipcRenderer.invoke(WorkspaceChannels.LIST),
  createWorkspace: (name: string) =>
    ipcRenderer.invoke(WorkspaceChannels.CREATE, name),
  deleteWorkspace: (name: string) =>
    ipcRenderer.invoke(WorkspaceChannels.DELETE, name),
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
  saveSession: (sessionId: string, messages: any[], metadata?: any) =>
    ipcRenderer.invoke(AiChannels.SESSION_SAVE, {
      sessionId,
      messages,
      metadata,
    }),
  loadSession: (sessionId: string, date: string) =>
    ipcRenderer.invoke(AiChannels.SESSION_LOAD, { sessionId, date }),
  runDirectCommand: (payload: any) =>
    ipcRenderer.invoke(SpellChannels.COMMAND_RUN_DIRECT, payload),
  respondToAiApproval: (id: string, approved: boolean) =>
    ipcRenderer.send(AiEventChannels.APPROVAL_RESPONSE, { id, approved }),
  getArtifactsStatus: () => ipcRenderer.invoke(AiChannels.ARTIFACTS_STATUS),

  // ── Git operations ────────────────────────────────────────────────────────
  getGitStatus: (path: string) => ipcRenderer.invoke(GitChannels.STATUS, path),
  getGitHeadContent: (path: string) =>
    ipcRenderer.invoke(GitChannels.HEAD_CONTENT, path),
  getGitIndexContent: (path: string) =>
    ipcRenderer.invoke(GitChannels.INDEX_CONTENT, path),
  getGitDiffStats: (root: string) =>
    ipcRenderer.invoke(GitChannels.DIFF_STATS, root),
  checkIsGitRoot: (path: string) =>
    ipcRenderer.invoke('aynite:git-is-root', path),
  stageHunk: (data: {
    filePath: string
    oldStart: number
    oldLines: string[]
    newStart: number
    newLines: string[]
  }) => ipcRenderer.invoke(GitChannels.STAGE_HUNK, data),
  discardHunk: (data: {
    filePath: string
    oldStart: number
    oldLines: string[]
    newStart: number
    newLines: string[]
  }) => ipcRenderer.invoke(GitChannels.DISCARD_HUNK, data),

  // ── System ──────────────────────────────────────────────────────────────
  openExternal: (url: string) =>
    ipcRenderer.invoke(SystemChannels.OPEN_EXTERNAL, url),
  getSystemFonts: () => ipcRenderer.invoke(SystemChannels.FONT_LIST),
  getAvailableViews: () => ipcRenderer.invoke(SystemChannels.VIEW_LIST),
  checkForUpdates: () => ipcRenderer.invoke(UpdateChannels.CHECK),
  selectFolder: () => ipcRenderer.invoke(SystemChannels.DIALOG_SELECT_FOLDER),
  selectFile: (options?: any) =>
    ipcRenderer.invoke(SystemChannels.DIALOG_SELECT_FILE, options),
  saveFileDialog: () => ipcRenderer.invoke(SystemChannels.DIALOG_SAVE_FILE),
  activateTile: (tileId: string) =>
    ipcRenderer.invoke(SystemChannels.TILE_ACTIVATE, tileId),
  minimizeWindow: () => ipcRenderer.invoke(SystemChannels.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(SystemChannels.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(SystemChannels.WINDOW_CLOSE),
  openNewWindow: () => ipcRenderer.invoke(SystemChannels.WINDOW_NEW),

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

  // ── RSS operations ──────────────────────────────────────────────────────
  rssGetConfig: () => ipcRenderer.invoke(RssChannels.GET_CONFIG),
  rssSaveConfig: (config: any) =>
    ipcRenderer.invoke(RssChannels.SAVE_CONFIG, config),
  rssFetchFeed: (sourceId: string) =>
    ipcRenderer.invoke(RssChannels.FETCH_FEED, sourceId),
  rssFetchAll: () => ipcRenderer.invoke(RssChannels.FETCH_ALL),
  rssGetContent: (sourceId: string) =>
    ipcRenderer.invoke(RssChannels.GET_CONTENT, sourceId),
  rssGetAllContents: () => ipcRenderer.invoke(RssChannels.GET_ALL_CONTENTS),
  rssGetBookmarks: () => ipcRenderer.invoke(RssChannels.GET_BOOKMARKS),
  rssToggleBookmark: (itemId: string, data: any) =>
    ipcRenderer.invoke(RssChannels.TOGGLE_BOOKMARK, { itemId, data }),
  rssMarkRead: (sourceId: string, itemId: string) =>
    ipcRenderer.invoke(RssChannels.MARK_READ, { sourceId, itemId }),
  rssMarkAllRead: (sourceId: string) =>
    ipcRenderer.invoke(RssChannels.MARK_ALL_READ, sourceId),
  rssDeleteSourceContent: (sourceId: string) =>
    ipcRenderer.invoke(RssChannels.DELETE_SOURCE_CONTENT, sourceId),

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
  onAppOperation: (callback: (operation: string, data?: unknown) => void) => {
    const listener = (_: any, operation: string, data?: unknown) => {
      callback(operation, data)
    }
    ipcRenderer.on(AppOperationChannel, listener)
    return () => ipcRenderer.removeListener(AppOperationChannel, listener)
  },

  executeAppOperation: (operation: string, data?: unknown) => {
    ipcRenderer.send(AppOperationChannel, operation, data)
  },

  // ── Utilities ───────────────────────────────────────────────────────────
  joinPath: (...paths: string[]) => paths.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '.',
  platform: process.platform,
  writeClipboard: (text: string) =>
    ipcRenderer.invoke(SystemChannels.CLIPBOARD_WRITE_TEXT, text),
}

// ─── Expose bridge ─────────────────────────────────────────────────────────
try {
  contextBridge.exposeInMainWorld('aynite', aynite)
} catch (error) {
  console.error('[Preload] Failed to expose Aynite bridge:', error)
}
