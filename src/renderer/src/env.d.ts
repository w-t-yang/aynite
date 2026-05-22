/// <reference types="vite/client" />

import type { WorkspacesConfig } from '../../lib/types/workspace'

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface ChatSessionEntry {
  id: string
  date: string
  lastModified: string
  size?: number
  preview: string
  title: string
  messageCount: number
}

interface SkillEntry {
  name: string
  description: string
  path: string
  error?: string
}

interface CommandEntry {
  name: string
  description: string
  parameters: any[]
  example: string
  path: string
  error?: string
}

interface AiChatPayload {
  messages: any[]
  config: any
  workspaceFolders: string[]
  activeFile?: string
}

interface DirectCommandPayload {
  commandPath: string
  params: string[]
  currentFile?: string
}

interface AyniteWindow {
  // Config
  getConfig: (key: string, payload?: any) => Promise<any>
  setConfig: (key: string, payload: any) => Promise<boolean>

  // File operations
  listFolder: (path: string) => Promise<FileEntry[]>
  readFile: (path: string) => Promise<string>
  readFileBinary: (path: string) => Promise<Uint8Array>
  openFile: (path: string) => Promise<boolean>
  writeFile: (path: string, content: string) => Promise<boolean>
  createFile: (path: string, isDirectory: boolean) => Promise<boolean>
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>
  copyFile: (srcPath: string, destPath: string) => Promise<boolean>
  deleteFile: (path: string) => Promise<boolean>
  getFileInfo: (path: string) => Promise<{
    name: string
    size: number
    createdAt: string
    modifiedAt: string
    isDirectory: boolean
    path: string
    extension: string
    isText: boolean
  }>
  refreshWatcher: () => Promise<void>
  getFiles: (path: string) => Promise<FileEntry[]>
  onFileSystemChange: (
    callback: (data: { event: string; path: string }) => void,
  ) => () => void
  move: (oldPath: string, newPath: string) => Promise<boolean>
  remove: (path: string) => Promise<boolean>
  copy: (path: string) => Promise<boolean>
  paste: (destDir: string) => Promise<boolean>

  deleteTheme: (name: string) => Promise<boolean>
  getThemes: () => Promise<string[]>
  getTheme: (name: string) => Promise<any>
  // Workspace
  getWorkspacesList: () => Promise<WorkspacesConfig>
  createWorkspace: (name: string) => Promise<WorkspacesConfig>
  deleteWorkspace: (name: string) => Promise<WorkspacesConfig>
  switchWorkspace: (name: string) => Promise<WorkspacesConfig>
  addWorkspaceFolder: () => Promise<string | null>
  removeWorkspaceFolder: (path: string) => Promise<boolean>
  reorderWorkspaceFolders: (folders: string[]) => Promise<boolean>
  getWorkspaceFolders: () => Promise<string[]>
  workspaceAllFiles: () => Promise<FileEntry[]>

  // AI operations
  aiChat: (
    payload: AiChatPayload,
  ) => Promise<{ requestId?: string; error?: string }>
  getMergedSystemPrompt: (
    globalFiles?: string[],
    agentFiles?: string[],
  ) => Promise<string>
  listSessions: () => Promise<ChatSessionEntry[]>
  saveSession: (
    sessionId: string,
    messages: any[],
    metadata?: any,
  ) => Promise<void>
  loadSession: (sessionId: string, date?: string) => Promise<any>
  runDirectCommand: (
    payload: DirectCommandPayload,
  ) => Promise<{ stdout: string; stderr: string }>
  respondToAiApproval: (id: string, approved: boolean) => void
  restorePrompts: () => Promise<boolean>
  onAiChatDelta: (
    requestId: string,
    callback: (part: any) => void,
  ) => () => void
  onAiApprovalRequest: (
    callback: (data: { id: string; command: string; cwd: string }) => void,
  ) => () => void

  // System
  openExternal: (url: string) => Promise<boolean>
  getSystemFonts: () => Promise<string[]>
  selectFolder: () => Promise<string[] | null>
  selectFile: (options?: any) => Promise<string[] | null>
  activateTile: (tileId: string) => Promise<boolean>
  minimizeWindow: () => Promise<boolean>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<boolean>
  openNewWindow: () => Promise<boolean>

  onAppOperation: (
    callback: (operation: string, data?: unknown) => void,
  ) => () => void
  onAppEvent: (
    callback: (event: { type: string; data: unknown }) => void,
  ) => () => void
  onThemeChanged: (callback: (themeId: string) => void) => () => void

  // Update
  installUpdate: () => Promise<void>
  checkForUpdates: () => void
  onUpdateChecking: (callback: () => void) => () => void
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateNotAvailable: (callback: () => void) => () => void
  onUpdateError: (callback: (err: string) => void) => () => void
  onUpdateProgress: (callback: (progress: any) => void) => () => void
  onUpdateDownloaded: (callback: (info: any) => void) => () => void

  // Skills & Commands
  getAvailableSkills: () => Promise<SkillEntry[]>
  getAvailableCommands: () => Promise<CommandEntry[]>
  getAvailableViews: () => Promise<{ id: string; name: string }[]>
  restoreSkills: () => Promise<boolean>
  restoreCommands: () => Promise<boolean>
  pickSkillFolder: () => Promise<string | null>
  pickCommandFolder: () => Promise<string | null>

  // RSS
  rssGetConfig: () => Promise<any>
  rssSaveConfig: (config: any) => Promise<boolean>
  rssFetchFeed: (sourceId: string) => Promise<any>
  rssFetchAll: () => Promise<any>
  rssGetContent: (sourceId: string) => Promise<any>
  rssGetAllContents: () => Promise<Record<string, any>>
  rssGetBookmarks: () => Promise<Record<string, any>>
  rssToggleBookmark: (itemId: string, data: any) => Promise<Record<string, any>>
  rssMarkRead: (sourceId: string, itemId: string) => Promise<boolean>
  rssMarkAllRead: (sourceId: string) => Promise<boolean>
  rssDeleteSourceContent: (sourceId: string) => Promise<boolean>

  // Spotify
  spotifyInitAuth: (
    clientId: string,
    useProtocol?: boolean,
  ) => Promise<{ success: boolean; error?: string }>
  spotifyCheckAuth: () => Promise<boolean>
  spotifyCheckProtocol: () => Promise<boolean>
  spotifyLogout: () => Promise<{ success: boolean; error?: string }>
  spotifyGetClientId: () => Promise<string>
  spotifyLoadAll: () => Promise<any>
  spotifyFetchAll: () => Promise<{
    success: boolean
    data?: any
    error?: string
  }>
  spotifyGetPlaybackState: () => Promise<any>
  spotifyPlay: () => Promise<{ success: boolean; error?: string }>
  spotifyPause: () => Promise<{ success: boolean; error?: string }>
  spotifyNext: () => Promise<{ success: boolean; error?: string }>
  spotifyPrevious: () => Promise<{ success: boolean; error?: string }>
  spotifyPlayTrack: (
    uri: string,
  ) => Promise<{ success: boolean; error?: string }>
  spotifyPlayTrackInContext: (
    trackUri: string,
    contextUri: string,
  ) => Promise<{ success: boolean; error?: string }>
  spotifyPlayTracks: (
    trackUris: string[],
    startUri?: string,
  ) => Promise<{ success: boolean; error?: string }>
  spotifyPlayContext: (
    uri: string,
  ) => Promise<{ success: boolean; error?: string }>
  spotifyGetPlaylistTracks: (
    playlistId: string,
  ) => Promise<{ success: boolean; data?: any; error?: string }>
  spotifyLoadPlaylistTracks: (
    playlistId: string,
  ) => Promise<{ success: boolean; data?: any }>

  checkIsTextFile: (path: string) => Promise<boolean>
  executeAppOperation: (operation: string, data?: unknown) => void
  writeClipboard: (text: string) => Promise<boolean>

  // Utilities
  joinPath: (...paths: string[]) => string
  dirname: (p: string) => string
  platform: string
}

declare global {
  interface Window {
    aynite: AyniteWindow
  }
}
