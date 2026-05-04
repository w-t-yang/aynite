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
}

export interface KeybindingConfig {
  [key: string]: string
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

  // Theme
  applyTheme: (theme: Theme) => Promise<void>
  onThemeChanged: (callback: (theme: Theme) => void) => () => void

  // File operations
  selectFile: () => Promise<string>
  selectFolder: () => Promise<string[] | null>
  listFolder: (path: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
  treeDir: (path: string) => Promise<any>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  createFile: (path: string, isDirectory: boolean) => Promise<boolean>
  move: (oldPath: string, newPath: string) => Promise<boolean>
  remove: (path: string) => Promise<boolean>
  copy: (path: string) => Promise<boolean>
  paste: (destDir: string) => Promise<boolean>
  getFiles: (path: string) => Promise<{ name: string; path: string; isDirectory: boolean }[]>
  aiChat: (payload: {
    messages: any[]
    config: any
    workspaceFolders: string[]
    activeFile?: string
  }) => Promise<{ requestId?: string; error?: string }>
  getMergedSystemPrompt: (payload: {
    globalFiles?: string[]
    agentFiles?: string[]
  }) => Promise<string>
  listChatLogs: () => Promise<any[]>
  saveChatLog: (payload: { id: string; messages: any[] }) => Promise<void>
  loadChatLog: (payload: { id: string; date: string }) => Promise<any>
  runDirectCommand: (payload: any) => Promise<any>
  respondToAiApproval: (id: string, approved: boolean) => void

  // Events
  onAppOperation: (callback: (operation: string) => void) => () => void
  onViewOperation: (callback: (operation: string) => void) => () => void
  onWorkspaceChanged: (callback: (data: any) => void) => () => void

  // Window operations
  minimize: () => void
  maximize: () => void
  close: () => void

  platform: string
}

declare global {
  interface Window {
    aynite: AyniteWindow
    electron: any
  }
}
