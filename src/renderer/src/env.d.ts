/// <reference types="vite/client" />

export interface AyniteWindow {
  // Config
  getConfig: (key: string, payload?: any) => Promise<any>
  setConfig: (key: string, payload: any) => Promise<boolean>

  // File operations
  listFolder: (path: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  createFile: (path: string, isDirectory: boolean) => Promise<boolean>
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>
  copyFile: (srcPath: string, destPath: string) => Promise<boolean>
  deleteFile: (path: string) => Promise<boolean>
  getFileInfo: (path: string) => Promise<{ size: number; createdAt: string; modifiedAt: string; isDirectory: boolean; path: string; extension: string; isText: boolean }>
  getFiles: (path: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
  onFileSystemChange: (callback: (data: { event: string; path: string }) => void) => () => void
  move: (oldPath: string, newPath: string) => Promise<boolean>
  remove: (path: string) => Promise<boolean>
  copy: (path: string) => Promise<boolean>
  paste: (destDir: string) => Promise<boolean>

  // Workspace
  getWorkspacesList: () => Promise<any>
  createWorkspace: (name: string) => Promise<any>
  switchWorkspace: (name: string) => Promise<boolean>
  addWorkspaceFolder: () => Promise<string | null>
  removeWorkspaceFolder: (path: string) => Promise<boolean>
  reorderWorkspaceFolders: (folders: string[]) => Promise<boolean>
  getWorkspaceFolders: () => Promise<string[]>
  workspaceAllFiles: () => Promise<any[]>

  // AI operations
  aiChat: (payload: any) => Promise<{ requestId?: string; error?: string }>
  getMergedSystemPrompt: {
    (globalFiles?: string[], agentFiles?: string[]): Promise<string>
    (payload: { globalFiles?: string[]; agentFiles?: string[] }): Promise<string>
  }
  listChatLogs: () => Promise<any[]>
  saveChatLog: {
    (sessionId: string, messages: any[]): Promise<void>
    (payload: { id: string; messages: any[] }): Promise<void>
  }
  loadChatLog: {
    (sessionId: string, date: string): Promise<any>
    (payload: { id: string; date: string }): Promise<any>
  }
  runDirectCommand: (payload: any) => Promise<any>
  respondToAiApproval: (id: string, approved: boolean) => void
  onAiChatDelta: (requestId: string, callback: (part: any) => void) => () => void
  onAiApprovalRequest: (callback: (data: { id: string; command: string; cwd: string }) => void) => () => void

  // System
  openExternal: (url: string) => Promise<boolean>
  getSystemFonts: () => Promise<string[]>
  selectFolder: () => Promise<string[] | null>

  onAppOperation: (callback: (operation: string) => void) => () => void

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
  getAvailableSkills: () => Promise<any[]>
  getAvailableCommands: () => Promise<any[]>
  getAvailableViews: () => Promise<{ id: string; name: string }[]>

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
