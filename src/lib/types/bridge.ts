import type { WorkspacesConfig } from './workspace'

export type ConfigSchema = {
  activeFile: string | null
  activeTheme: string
  activeWorkspace: string
  activeSessionId: string | null
  version: string
  language: string
  ai: { activeId: string; providers?: any[] }
  agents: { activeId: string; list?: any[] }
  prompts: { files?: string[] }
  tools: { active?: Record<string, boolean> }
  skills: any
  commands: any
  keybindings: any
  themes: any[]
  workspaces: WorkspacesConfig
  workspace: any
  theme: any
  'theme-delete': string
  openedFiles: string[]
  'view-config': any
  'matching-views': any
  chatLogs: any
  'load-chat-log': any
  'save-chat-log': any
  'session-delete': string
  'tile-data': any
  'playbook-path': string
  telemetry: { enabled: boolean; clientId?: string }
}

export interface GlobalAPI {
  saveActiveTab: () => void
  reload: () => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  focusChat: () => void
  focusSkills: () => void
  focusCommands: () => void
  closeTab: () => void
  switchTab: () => void
  focusContent: () => void
  closeFileSwitcher: () => void
  isFileSwitcherOpen: () => boolean
  toggleFileSwitcher: () => void
}

export interface FileSwitcherAPI {
  moveSelection: (dir: 'up' | 'down') => void
  confirmSelection: () => void
}

export interface SettingsAPI {
  close: () => void
  submit: () => void
}

export interface SidebarAPI {
  copy: () => void
  paste: () => void
  submit: () => void
}

export interface ChatAPI {
  selectAll: () => void
}

export interface EditorAPI {
  isEditing: () => boolean
  isSearchActive: () => boolean
  isSearchInputFocused: (target: EventTarget | null) => boolean
  getCategory: () => string

  setIsEditing: (val: boolean) => void
  setSearchActive: (val: boolean) => void
  nextSearch: () => void

  moveCursor: (dir: 'up' | 'down' | 'left' | 'right') => void

  endOfLine: () => void
  startOfLine: () => void
  killLine: () => void
  deleteForward: () => void
  selectAll: () => void
  refresh: () => void
}
