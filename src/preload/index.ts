import { contextBridge, ipcRenderer } from 'electron'
import {
  AiChannels,
  AiEventChannels,
  AppEventChannel,
  AppOperationChannel,
  ConfigChannels,
  FileChannels,
  FlowChannels,
  GitChannels,
  LoggerChannels,
  MessengerChannels,
  RssChannels,
  SpellChannels,
  SpotifyChannels,
  SystemChannels,
  ThemeChannels,
  UpdateChannels,
  WorkspaceChannels,
} from '../lib/constants/ipc-channels'
import { splitPath } from '../lib/platform'

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
  readFileBinary: (path: string) =>
    ipcRenderer.invoke(FileChannels.READ_BINARY, path),
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
  watchFile: (path: string | null) =>
    ipcRenderer.invoke(FileChannels.WATCH_FILE, path),

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
  getMergedSystemPrompt: (agentId?: string) =>
    ipcRenderer.invoke(AiChannels.PROMPT_GET_MERGED, agentId),
  restorePrompts: () => ipcRenderer.invoke(AiChannels.PROMPT_RESTORE),
  listSessions: () => ipcRenderer.invoke(AiChannels.SESSION_LIST),
  getActivityCounts: () => ipcRenderer.invoke(AiChannels.GET_ACTIVITY_COUNTS),
  getMessengerSessionCount: () =>
    ipcRenderer.invoke(AiChannels.GET_MESSENGER_SESSION_COUNT),
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
  getSessionMetadata: (sessionId: string) =>
    ipcRenderer.invoke(AiChannels.SESSION_META_LOAD, sessionId),
  saveCompactBackup: (sessionId: string, timestamp: number, messages: any[]) =>
    ipcRenderer.invoke(AiChannels.SESSION_SAVE_COMPACT, {
      sessionId,
      timestamp,
      messages,
    }),

  // ── Git operations ────────────────────────────────────────────────────────
  getGitStatus: (path: string) => ipcRenderer.invoke(GitChannels.STATUS, path),
  refreshGitStatus: (path: string) =>
    ipcRenderer.invoke(GitChannels.REFRESH_STATUS, path),
  getGitHeadContent: (path: string) =>
    ipcRenderer.invoke(GitChannels.HEAD_CONTENT, path),
  getGitIndexContent: (path: string) =>
    ipcRenderer.invoke(GitChannels.INDEX_CONTENT, path),
  getGitDiffStats: (root: string) =>
    ipcRenderer.invoke(GitChannels.DIFF_STATS, root),
  checkIsGitRoot: (path: string) =>
    ipcRenderer.invoke('aynite:git-is-root', path),
  commitGenerate: (root: string) =>
    ipcRenderer.invoke(GitChannels.COMMIT_GENERATE, root),
  commitExecute: (root: string, message: string) =>
    ipcRenderer.invoke(GitChannels.COMMIT_EXECUTE, root, message),
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
  stageFile: (filePath: string) =>
    ipcRenderer.invoke(GitChannels.STAGE_FILE, filePath),
  unstageFile: (filePath: string) =>
    ipcRenderer.invoke(GitChannels.UNSTAGE_FILE, filePath),
  stageAll: (root: string) => ipcRenderer.invoke(GitChannels.STAGE_ALL, root),
  unstageAll: (root: string) =>
    ipcRenderer.invoke(GitChannels.UNSTAGE_ALL, root),
  getSplitStatus: (root: string) =>
    ipcRenderer.invoke(GitChannels.SPLIT_STATUS, root),

  // ── System ──────────────────────────────────────────────────────────────
  openExternal: (url: string) =>
    ipcRenderer.invoke(SystemChannels.OPEN_EXTERNAL, url),
  getSystemFonts: () => ipcRenderer.invoke(SystemChannels.FONT_LIST),
  getAvailableViews: () => ipcRenderer.invoke(SystemChannels.VIEW_LIST),
  checkForUpdates: () => ipcRenderer.invoke(UpdateChannels.CHECK),
  downloadUpdate: () => ipcRenderer.invoke(UpdateChannels.DOWNLOAD),
  installUpdate: () => ipcRenderer.invoke(UpdateChannels.INSTALL),
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
  openDevTools: () => ipcRenderer.invoke(SystemChannels.WINDOW_DEVTOOLS),

  // ── Theme operations ────────────────────────────────────────────────────
  getThemes: () => ipcRenderer.invoke(ThemeChannels.LIST),
  getTheme: (name: string) => ipcRenderer.invoke(ThemeChannels.READ, name),
  deleteTheme: (name: string) => ipcRenderer.invoke(ThemeChannels.DELETE, name),

  // ── Spells ──────────────────────────────────────────────────────────────
  getAvailableSkills: () => ipcRenderer.invoke(SpellChannels.SKILL_LIST),
  getAvailableCommands: () => ipcRenderer.invoke(SpellChannels.COMMAND_LIST),
  pickSkillFolder: () => ipcRenderer.invoke(SpellChannels.SKILL_ADD_FOLDER),
  installSkillFromGitHub: (url: string, destPath?: string) =>
    ipcRenderer.invoke(SpellChannels.SKILL_INSTALL_GITHUB, url, destPath),
  pickCommandFolder: () => ipcRenderer.invoke(SpellChannels.COMMAND_ADD_FOLDER),
  restoreSkills: () => ipcRenderer.invoke(SpellChannels.SKILL_RESTORE),
  restoreCommands: () => ipcRenderer.invoke(SpellChannels.COMMAND_RESTORE),

  // ── Messenger operations ───────────────────────────────────────────────
  testMessenger: (provider: string, apiKey: string) =>
    ipcRenderer.invoke(MessengerChannels.TEST, { provider, apiKey }),

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
  rssSummarizeArticle: (
    itemId: string,
    url: string,
    content?: string,
    contentSnippet?: string,
  ) =>
    ipcRenderer.invoke(RssChannels.SUMMARIZE, {
      itemId,
      url,
      content,
      contentSnippet,
    }),

  // ── Flows operations ─────────────────────────────────────────────────
  flowList: () => ipcRenderer.invoke(FlowChannels.LIST),
  flowCreate: () => ipcRenderer.invoke(FlowChannels.CREATE),
  flowUpdate: (flowId: string, updates: any) =>
    ipcRenderer.invoke(FlowChannels.UPDATE, flowId, updates),

  // ── Spotify operations ────────────────────────────────────────────────
  spotifyInitAuth: (clientId: string, useProtocol?: boolean) =>
    ipcRenderer.invoke(SpotifyChannels.INIT_AUTH, clientId, useProtocol),
  spotifyCheckAuth: () => ipcRenderer.invoke(SpotifyChannels.CHECK_AUTH),
  spotifyCheckProtocol: () =>
    ipcRenderer.invoke(SpotifyChannels.CHECK_PROTOCOL),
  spotifyLogout: () => ipcRenderer.invoke(SpotifyChannels.LOGOUT),
  spotifyGetClientId: () => ipcRenderer.invoke(SpotifyChannels.GET_CLIENT_ID),
  spotifyLoadAll: () => ipcRenderer.invoke(SpotifyChannels.LOAD_ALL),
  spotifyFetchAll: () => ipcRenderer.invoke(SpotifyChannels.FETCH_ALL),
  spotifyGetPlaybackState: () =>
    ipcRenderer.invoke(SpotifyChannels.GET_PLAYBACK_STATE),
  spotifyPlay: () => ipcRenderer.invoke(SpotifyChannels.PLAY),
  spotifyPause: () => ipcRenderer.invoke(SpotifyChannels.PAUSE),
  spotifyNext: () => ipcRenderer.invoke(SpotifyChannels.NEXT),
  spotifyPrevious: () => ipcRenderer.invoke(SpotifyChannels.PREVIOUS),
  spotifyPlayTrack: (uri: string) =>
    ipcRenderer.invoke(SpotifyChannels.PLAY_TRACK, uri),
  spotifyPlayTrackInContext: (trackUri: string, contextUri: string) =>
    ipcRenderer.invoke(
      SpotifyChannels.PLAY_TRACK_IN_CONTEXT,
      trackUri,
      contextUri,
    ),
  spotifyPlayTracks: (trackUris: string[], startUri?: string) =>
    ipcRenderer.invoke(SpotifyChannels.PLAY_TRACKS, trackUris, startUri),
  spotifyPlayContext: (uri: string) =>
    ipcRenderer.invoke(SpotifyChannels.PLAY_CONTEXT, uri),
  spotifyGetPlaylistTracks: (playlistId: string) =>
    ipcRenderer.invoke(SpotifyChannels.GET_PLAYLIST_TRACKS, playlistId),
  spotifyLoadPlaylistTracks: (playlistId: string) =>
    ipcRenderer.invoke(SpotifyChannels.LOAD_PLAYLIST_TRACKS, playlistId),

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
  /**
   * Join path segments using forward slashes.
   * Each segment is split on both / and \ then rejoined with /.
   * This ensures correct behavior on Windows where filesystem paths
   * use backslashes but IPC and display paths use forward slashes.
   *
   * Preserves leading slash for absolute paths like /home/user/...
   * (splitPath produces an empty string at index 0 for absolute paths;
   *  filter(Boolean) would incorrectly strip it, turning /home into home)
   */
  joinPath: (...paths: string[]) => {
    const parts = paths.flatMap((p) => splitPath(p))
    const hasLeadingSlash = parts.length > 0 && parts[0] === ''
    const joined = parts.filter(Boolean).join('/')
    return hasLeadingSlash ? `/${joined}` : joined
  },
  /**
   * Get the parent directory of a path.
   * Works with both / and \ separators via splitPath.
   * Preserves leading slash for absolute paths.
   */
  dirname: (p: string) => {
    const parts = splitPath(p)
    const hasLeadingSlash = parts.length > 0 && parts[0] === ''
    const filtered = parts.filter(Boolean)
    if (filtered.length <= 1) return hasLeadingSlash ? '/' : '.'
    const joined = filtered.slice(0, -1).join('/')
    return hasLeadingSlash ? `/${joined}` : joined
  },
  platform: process.platform,
  homedir: require('node:os').homedir(),
  writeClipboard: (text: string) =>
    ipcRenderer.invoke(SystemChannels.CLIPBOARD_WRITE_TEXT, text),
  log: (level: string, ...args: unknown[]) =>
    ipcRenderer.invoke(LoggerChannels.LOG, level, ...args),
}

// ─── Expose bridge ─────────────────────────────────────────────────────────
try {
  contextBridge.exposeInMainWorld('aynite', aynite)
} catch (error) {
  console.error('[Preload] Failed to expose Aynite bridge:', error)
}
