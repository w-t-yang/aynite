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
  name?: string
  data?: Record<string, any>
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
  /** System layouts (Home, Projects, Settings) cannot be modified or removed */
  system?: boolean
  /** Fixed layouts prevent tile add/delete operations but allow resizing */
  fixed?: boolean
}

export interface WorkspaceConfig {
  id: string
  layouts: LayoutConfig[]
  activeLayoutId: string
  activeAgentId: string
  activeSessionId: string | null
  folders: string[]
  files: string[]
  activeFile?: string
}

export interface Keybinding {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  key: string
}

export interface KeybindingConfig {
  app: { [key: string]: Keybinding }
  view: { [key: string]: Keybinding }
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

export interface MainConfig {
  lastUsed?: string
  activeTheme?: string
  language?: string
  aiTools?: Record<string, boolean>
  /** The default agent ID used when workspace state does not specify one.
   *  Individual agent configs are stored in ~/.aynite/agents/<id>.json */
  defaultAgentId?: string
  /** @deprecated Agents are now stored as individual files in ~/.aynite/agents/.
   *  This field may still hold legacy data during migration. */
  agents?: {
    activeId: string
    list: Array<{
      id: string
      name: string
      promptFiles: string[]
    }>
  }
  prompts?: {
    files: string[]
  }
  skills?: {
    folders: string[]
  }
  commands?: {
    folders: string[]
  }
  views?: View[]
  [key: string]: unknown // Allow unknown keys for forward compat
}

export interface Theme {
  id: string
  name: string
  type: 'light' | 'dark'
  isSystem?: boolean
  colors: Record<string, string>
  fonts?: {
    fontFamily?: string
    fontMono?: string
    fontSize?: string
  }
}
