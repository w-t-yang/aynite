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


