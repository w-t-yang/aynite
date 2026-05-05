export type Direction = 'horizontal' | 'vertical'

export interface BaseNode {
  id: string
  size: number // percentage (0-100)
}

export interface SplitNode extends BaseNode {
  type: 'split'
  direction: Direction
  children: (SplitNode | LeafNode)[]
}

export interface LeafNode extends BaseNode {
  type: 'leaf'
  content: string
  url?: string
}

export type LayoutNode = SplitNode | LeafNode

export interface SelectionItem {
  id: string
  label?: string
  layout: LayoutNode
}

export interface LayoutConfig {
  id: string
  name: string
  layout: LayoutNode
}

export interface WorkspaceConfig {
  id: string
  layouts: LayoutConfig[]
  activeLayoutId: string
  folders: string[]
  files: string[]
  activeFile?: string
  tabs?: any[] // Legacy compatibility
  activeTabId?: string // Legacy compatibility
}


export interface KeybindingConfig {
  global: { [key: string]: string }
  explorer: { [key: string]: string }
  agent: { [key: string]: string }
  content: {
    navigation: { [key: string]: string }
    viewer: { [key: string]: string }
    generic: { [key: string]: string }
  }
}


export interface View {
  id: string
  path: string
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  isExpanded?: boolean
}

export interface Theme {
  id: string
  name: string
  type: 'light' | 'dark'
  colors: Record<string, string>
  fonts?: {
    fontFamily?: string
    fontMono?: string
    fontSize?: string
  }
}

export interface GlobalSettings {
  activeTheme: string
}

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
