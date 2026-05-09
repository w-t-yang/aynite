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
