export interface WorkspaceTab {
  id: string
  type: 'file' | 'settings' | 'chat' | string
  title: string
  filepath?: string
  cursorPos?: number
  [key: string]: any // Allow other properties from renderer
}

export interface WorkspaceData {
  folders: string[]
  tabs: WorkspaceTab[]
  activeTabId: string
  name?: string
}

export interface WorkspacesConfig {
  active: string
  list: string[]
}
