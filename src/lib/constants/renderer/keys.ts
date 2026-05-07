import type { Keybinding } from '../../../renderer/shared/lib/types'
import type {
  ChatAPI,
  EditorAPI,
  GlobalAPI,
  SettingsAPI,
  SidebarAPI,
  TabSwitcherAPI,
} from '../../types/bridge'
import { AppOperation, ViewOperation } from '../app'

export type {
  ChatAPI,
  EditorAPI,
  GlobalAPI,
  SettingsAPI,
  SidebarAPI,
  TabSwitcherAPI,
}

// Internal State
let globalApi: GlobalAPI | null = null
const tabApis = new Map<string, EditorAPI>()
let tabSwitcherApi: TabSwitcherAPI | null = null
let settingsApi: SettingsAPI | null = null
let sidebarApi: SidebarAPI | null = null
let chatApi: ChatAPI | null = null
let activeTabId: string | null = null
let settings: any = null
let isInitialized = false

function checkMatch(e: KeyboardEvent, kb: Keybinding | undefined): boolean {
  if (!kb) return false
  const isDarwin = window.navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const isShift = e.shiftKey
  const isAlt = e.altKey

  return (
    !!kb.ctrl === (e.ctrlKey || (!isDarwin && e.metaKey)) &&
    !!kb.meta === (isDarwin ? e.metaKey : false) &&
    !!kb.shift === isShift &&
    !!kb.alt === isAlt &&
    e.key.toUpperCase() === kb.key.toUpperCase()
  )
}

const handleEditorKeys = (
  e: KeyboardEvent,
  api: EditorAPI,
  kb: any,
): boolean => {
  const isCmd = e.metaKey || e.ctrlKey
  const key = e.key.toUpperCase()

  if (api.isSearchActive()) {
    if (e.key === 'Escape' || (isCmd && key === 'G')) {
      e.preventDefault()
      api.setSearchActive(false)
      return true
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      api.nextSearch()
      return true
    }
    if (api.isSearchInputFocused(e.target)) return false
  }

  if (!api.isEditing()) {
    if (checkMatch(e, kb.view[ViewOperation.MARK_WHOLE_BUFFER])) {
      e.preventDefault()
      api.setIsEditing(true)
      return true
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      return true
    }

    const v = kb.view
    if (checkMatch(e, v[ViewOperation.NEXT_LINE])) {
      e.preventDefault()
      api.moveCursor('down')
      return true
    } else if (checkMatch(e, v[ViewOperation.PREVIOUS_LINE])) {
      e.preventDefault()
      api.moveCursor('up')
      return true
    } else if (checkMatch(e, v[ViewOperation.BACKWARD_CHAR])) {
      e.preventDefault()
      api.moveCursor('left')
      return true
    } else if (checkMatch(e, v[ViewOperation.FORWARD_CHAR])) {
      e.preventDefault()
      api.moveCursor('right')
      return true
    }
  }

  const v = kb.view
  if (
    api.isEditing() &&
    (e.key === 'Escape' || checkMatch(e, v[ViewOperation.KEYBOARD_QUIT]))
  ) {
    e.preventDefault()
    api.setIsEditing(false)
    return true
  } else if (checkMatch(e, v[ViewOperation.END_OF_LINE])) {
    e.preventDefault()
    api.endOfLine()
    return true
  } else if (checkMatch(e, v[ViewOperation.BEGINNING_OF_LINE])) {
    e.preventDefault()
    api.startOfLine()
    return true
  } else if (checkMatch(e, v[ViewOperation.KILL_LINE])) {
    if (!api.isEditing()) return true
    e.preventDefault()
    api.killLine()
    return true
  } else if (checkMatch(e, v[ViewOperation.DELETE_CHAR])) {
    if (!api.isEditing()) return true
    e.preventDefault()
    api.deleteForward()
    return true
  }

  return false
}

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  // 1. System/Critical Overrides
  if (
    (e.ctrlKey || e.metaKey) &&
    (e.key === '\\' || e.code === 'Backslash' || e.key === '|')
  )
    return
  if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'I') return // Let devtools pass

  const isCmd = e.metaKey || e.ctrlKey
  const key = e.key.toUpperCase()

  if (!settings || !globalApi) return
  const kb = settings.keybindings

  // 2. Global Shortcuts (Highest Priority)
  if (isCmd && key === 'S') {
    e.preventDefault()
    globalApi.saveActiveTab()
    return
  }

  if (checkMatch(e, kb.app[AppOperation.REFRESH_APP])) {
    e.preventDefault()
    globalApi.reload()
    return
  }
  if (checkMatch(e, kb.app[AppOperation.TOGGLE_LEFT_PANEL])) {
    e.preventDefault()
    globalApi.toggleLeftPanel()
    return
  }
  if (checkMatch(e, kb.app[AppOperation.TOGGLE_RIGHT_PANEL])) {
    e.preventDefault()
    globalApi.toggleRightPanel()
    return
  }
  if (checkMatch(e, kb.app[AppOperation.FOCUS_CHAT])) {
    e.preventDefault()
    globalApi.focusChat()
    return
  }
  if (checkMatch(e, kb.app[AppOperation.FOCUS_SKILLS])) {
    e.preventDefault()
    globalApi.focusSkills()
    return
  }
  if (checkMatch(e, kb.app[AppOperation.FOCUS_COMMANDS])) {
    e.preventDefault()
    globalApi.focusCommands()
    return
  }

  // 2.5 Tab Refresh (Catch early to prevent browser reload)
  if (
    checkMatch(
      e,
      kb.view[ViewOperation.REFRESH] || kb.app[AppOperation.REFRESH_APP],
    )
  ) {
    e.preventDefault()
    if (activeTabId && tabApis.has(activeTabId)) {
      tabApis.get(activeTabId)?.refresh()
    }
    return
  }

  // 3. Tab Switcher Delegation
  const el = e.target as HTMLElement
  if (globalApi.isTabSwitcherOpen() && tabSwitcherApi) {
    if (e.key === 'Escape' || (isCmd && key === 'G')) {
      e.preventDefault()
      globalApi.closeTabSwitcher()
      return
    }

    if (e.key === 'Enter' || (e.key === 'Tab' && !isCmd)) {
      e.preventDefault()
      tabSwitcherApi.confirmSelection()
      return
    }

    if (
      e.key === 'ArrowUp' ||
      (isCmd && key === 'P') ||
      (isCmd && e.key === 'Tab' && e.shiftKey)
    ) {
      e.preventDefault()
      tabSwitcherApi.moveSelection('up')
      return
    }

    if (
      e.key === 'ArrowDown' ||
      (isCmd && key === 'N') ||
      (isCmd && e.key === 'Tab' && !e.shiftKey)
    ) {
      e.preventDefault()
      tabSwitcherApi.moveSelection('down')
      return
    }

    // If switcher is open, we generally don't want to fall through to other things
    // unless it's the search input (already handled by being the event target)
    if (el && el.tagName === 'INPUT') return

    e.preventDefault()
    return
  }

  // 4. Delegate to Active Component
  let context: 'editor' | 'chat' | 'settings' | 'sidebar' | 'other' = 'editor'

  if (
    el &&
    ((el as any) instanceof HTMLElement || (el as any) instanceof Element) &&
    typeof (el as any).closest === 'function'
  ) {
    if (el.closest('.chat-input-editor') || el.closest('.chat-input-wrapper')) {
      context = 'chat'
    } else if (el.closest('.settings-panel')) {
      context = 'settings'
    } else if (
      el.closest('.sidebar-panel') ||
      el.closest('.sidebar-container')
    ) {
      context = 'sidebar'
    } else if (el.tagName === 'INPUT' && !el.closest('.file-viewer-search')) {
      context = 'other'
    }
  }

  if (context === 'chat' && chatApi) {
    if (checkMatch(e, kb.app[AppOperation.SUBMIT_CHAT])) {
      e.preventDefault()
      chatApi.submit()
      return
    }
    if (isCmd && key === 'Q') {
      e.preventDefault()
      chatApi.selectAll()
      return
    }
  }

  if (context === 'settings' && settingsApi) {
    if (e.key === 'Escape' || (isCmd && key === 'G')) {
      e.preventDefault()
      settingsApi.close()
      return
    }
    if (e.key === 'Enter' && el.tagName === 'INPUT') {
      e.preventDefault()
      settingsApi.submit()
      return
    }
  }

  if (context === 'sidebar' && sidebarApi) {
    if (isCmd && key === 'C') {
      e.preventDefault()
      sidebarApi.copy()
      return
    }
    if (isCmd && key === 'V') {
      e.preventDefault()
      sidebarApi.paste()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      sidebarApi.submit()
      return
    }
  }

  if (context === 'editor' && activeTabId && tabApis.has(activeTabId)) {
    const api = tabApis.get(activeTabId)
    if (api) {
      const handled = handleEditorKeys(e, api, kb)
      if (handled) return
    }
  }
}

const handleGlobalKeyUp = (_e: KeyboardEvent) => {
  // Optional: implement if needed
}

export const KeyManager = {
  init(s: any, api: GlobalAPI) {
    settings = s
    globalApi = api

    if (!isInitialized) {
      window.addEventListener('keydown', handleGlobalKeyDown, true)
      window.addEventListener('keyup', handleGlobalKeyUp, true)
      isInitialized = true
    }
  },

  cleanup() {
    window.removeEventListener('keydown', handleGlobalKeyDown, true)
    window.removeEventListener('keyup', handleGlobalKeyUp, true)
    isInitialized = false
  },

  setActiveTab(tabId: string | null) {
    activeTabId = tabId
  },

  registerEditor(tabId: string, api: EditorAPI) {
    tabApis.set(tabId, api)
  },

  unregisterEditor(tabId: string) {
    tabApis.delete(tabId)
  },

  registerTabSwitcher(api: TabSwitcherAPI) {
    tabSwitcherApi = api
  },

  unregisterTabSwitcher() {
    tabSwitcherApi = null
  },

  registerSettings(api: SettingsAPI) {
    settingsApi = api
  },

  unregisterSettings() {
    settingsApi = null
  },

  registerSidebar(api: SidebarAPI) {
    sidebarApi = api
  },

  unregisterSidebar() {
    sidebarApi = null
  },

  registerChat(api: ChatAPI) {
    chatApi = api
  },

  unregisterChat() {
    chatApi = null
  },
}
