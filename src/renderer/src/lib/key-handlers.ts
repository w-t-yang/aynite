export interface GlobalAPI {
  saveActiveTab: () => void;
  reload: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  focusChat: () => void;
  focusSkills: () => void;
  focusCommands: () => void;
  closeTab: () => void;
  switchTab: () => void;
  focusContent: () => void;
  closeTabSwitcher: () => void;
  isTabSwitcherOpen: () => boolean;
}

export interface TabSwitcherAPI {
  moveSelection: (dir: 'up' | 'down') => void;
  confirmSelection: () => void;
}

export interface SettingsAPI {
  close: () => void;
  confirm: () => void;
}

export interface SidebarAPI {
  copy: () => void;
  paste: () => void;
  confirm: () => void;
}

export interface ChatAPI {
  submit: () => void;
  selectAll: () => void;
}

export interface EditorAPI {
  isEditing: () => boolean;
  isSearchActive: () => boolean;
  isSearchInputFocused: (target: EventTarget | null) => boolean;
  getCategory: () => string;
  
  setIsEditing: (val: boolean) => void;
  setSearchActive: (val: boolean) => void;
  nextSearch: () => void;
  
  moveCursor: (dir: 'up' | 'down' | 'left' | 'right') => void;
  
  endOfLine: () => void;
  startOfLine: () => void;
  killLine: () => void;
  selectAll: () => void;
}

export class KeyManager {
  private static globalApi: GlobalAPI | null = null;
  private static tabApis = new Map<string, EditorAPI>();
  private static tabSwitcherApi: TabSwitcherAPI | null = null;
  private static settingsApi: SettingsAPI | null = null;
  private static sidebarApi: SidebarAPI | null = null;
  private static chatApi: ChatAPI | null = null;
  private static activeTabId: string | null = null;
  private static settings: any = null;
  private static isInitialized = false;

  static init(settings: any, globalApi: GlobalAPI) {
    this.settings = settings;
    this.globalApi = globalApi;

    if (!this.isInitialized) {
      window.addEventListener('keydown', this.handleGlobalKeyDown, true);
      window.addEventListener('keyup', this.handleGlobalKeyUp, true);
      this.isInitialized = true;
    }
  }

  static cleanup() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown, true);
    window.removeEventListener('keyup', this.handleGlobalKeyUp, true);
    this.isInitialized = false;
    this.globalApi = null;
    this.tabApis.clear();
    this.tabSwitcherApi = null;
  }

  static setActiveTab(tabId: string | null) {
    this.activeTabId = tabId;
  }

  static registerEditor(tabId: string, api: EditorAPI) {
    this.tabApis.set(tabId, api);
  }

  static unregisterEditor(tabId: string) {
    this.tabApis.delete(tabId);
  }

  static registerTabSwitcher(api: TabSwitcherAPI) {
    this.tabSwitcherApi = api;
  }

  static unregisterTabSwitcher() {
    this.tabSwitcherApi = null;
  }

  static registerSettings(api: SettingsAPI) {
    this.settingsApi = api;
  }

  static unregisterSettings() {
    this.settingsApi = null;
  }

  static registerSidebar(api: SidebarAPI) {
    this.sidebarApi = api;
  }

  static unregisterSidebar() {
    this.sidebarApi = null;
  }

  static registerChat(api: ChatAPI) {
    this.chatApi = api;
  }

  static unregisterChat() {
    this.chatApi = null;
  }

  private static checkMatch(e: KeyboardEvent, shortcutStr: string | undefined): boolean {
    if (!shortcutStr) return false;
    const parts = shortcutStr.toUpperCase().split('+');
    const targetKey = parts[parts.length - 1];
    const key = e.key.toUpperCase();
    
    return key === targetKey && 
           parts.includes('CTRL') === (e.ctrlKey || e.metaKey) && 
           parts.includes('SHIFT') === e.shiftKey && 
           parts.includes('ALT') === e.altKey;
  }

  private static handleGlobalKeyDown = (e: KeyboardEvent) => {
    // 1. System/Critical Overrides
    if ((e.ctrlKey || e.metaKey) && (e.key === '\\' || e.code === 'Backslash' || e.key === '|')) return;
    if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === 'I') return; // Let devtools pass

    const isCmd = e.metaKey || e.ctrlKey;
    const key = e.key.toUpperCase();

    if (!this.settings || !this.globalApi) return;
    const kb = this.settings.keybindings;

    // 2. Global Shortcuts (Highest Priority)
    if (isCmd && key === 'S') { e.preventDefault(); this.globalApi.saveActiveTab(); return; }
    if (this.checkMatch(e, kb.global.refresh)) { e.preventDefault(); this.globalApi.reload(); return; }
    if (this.checkMatch(e, kb.explorer.toggleLeftPanel)) { e.preventDefault(); this.globalApi.toggleLeftPanel(); return; }
    if (this.checkMatch(e, kb.agent.toggleRightPanel)) { e.preventDefault(); this.globalApi.toggleRightPanel(); return; }
    if (this.checkMatch(e, kb.agent.focusChat)) { e.preventDefault(); this.globalApi.focusChat(); return; }
    if (this.checkMatch(e, kb.agent.focusSkills)) { e.preventDefault(); this.globalApi.focusSkills(); return; }
    if (this.checkMatch(e, kb.agent.focusCommands)) { e.preventDefault(); this.globalApi.focusCommands(); return; }
    if (this.checkMatch(e, kb.content.navigation.closeTab)) { e.preventDefault(); this.globalApi.closeTab(); return; }
    if (this.checkMatch(e, kb.content.navigation.switchTab)) { e.preventDefault(); this.globalApi.switchTab(); return; }
    if (this.checkMatch(e, kb.content.navigation.focusContent)) { e.preventDefault(); this.globalApi.focusContent(); return; }

    // 3. Tab Switcher Delegation
    const el = e.target as HTMLElement;
    if (this.globalApi.isTabSwitcherOpen() && this.tabSwitcherApi) {
      if (e.key === 'Escape' || (isCmd && key === 'G')) {
        e.preventDefault();
        this.globalApi.closeTabSwitcher();
        return;
      }
      
      if (e.key === 'Enter' || (e.key === 'Tab' && !isCmd)) {
        e.preventDefault();
        this.tabSwitcherApi.confirmSelection();
        return;
      }

      if (e.key === 'ArrowUp' || (isCmd && key === 'P') || (isCmd && e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        this.tabSwitcherApi.moveSelection('up');
        return;
      }

      if (e.key === 'ArrowDown' || (isCmd && key === 'N') || (isCmd && e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        this.tabSwitcherApi.moveSelection('down');
        return;
      }
      
      // If switcher is open, we generally don't want to fall through to other things
      // unless it's the search input (already handled by being the event target)
      if (el && el.tagName === 'INPUT') return;
      
      e.preventDefault();
      return;
    }

    // 4. Delegate to Active Component
    let context: 'editor' | 'chat' | 'settings' | 'sidebar' | 'other' = 'editor';
    
    if (el) {
      if (el.closest('.chat-input-editor') || el.closest('.chat-input-wrapper')) {
        context = 'chat';
      } else if (el.closest('.settings-panel')) {
        context = 'settings';
      } else if (el.closest('.sidebar-panel') || el.closest('.sidebar-container')) {
        context = 'sidebar';
      } else if (el.tagName === 'INPUT' && !el.closest('.file-viewer-search')) {
        context = 'other';
      }
    }

    if (context === 'chat' && this.chatApi) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.chatApi.submit();
        return;
      }
      if (isCmd && key === 'Q') {
        e.preventDefault();
        this.chatApi.selectAll();
        return;
      }
    }

    if (context === 'settings' && this.settingsApi) {
      if (e.key === 'Escape' || (isCmd && key === 'G')) {
        e.preventDefault();
        this.settingsApi.close();
        return;
      }
      if (e.key === 'Enter' && el.tagName === 'INPUT') {
        e.preventDefault();
        this.settingsApi.confirm();
        return;
      }
    }

    if (context === 'sidebar' && this.sidebarApi) {
      if (isCmd && key === 'C') {
        e.preventDefault();
        this.sidebarApi.copy();
        return;
      }
      if (isCmd && key === 'V') {
        e.preventDefault();
        this.sidebarApi.paste();
        return;
      }
      if (e.key === 'Enter' && el.tagName === 'INPUT') {
        e.preventDefault();
        this.sidebarApi.confirm();
        return;
      }
    }

    if (context === 'editor' && this.activeTabId && this.tabApis.has(this.activeTabId)) {
      const handled = this.handleEditorKeys(e, this.tabApis.get(this.activeTabId)!, kb);
      if (handled) return;
    }
  };

  private static handleGlobalKeyUp = (e: KeyboardEvent) => {
    // Releasing Ctrl/Meta no longer auto-confirms selection.
    // The TabSwitcher will now stay open until explicit confirmation (Enter/Click) or cancel (Escape).
  };

  private static handleEditorKeys(e: KeyboardEvent, api: EditorAPI, keybindings: any): boolean {
    const isCmd = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;
    const key = e.key.toUpperCase();

    if (e.key === 'Tab') {
      const target = e.target as HTMLElement;
      if (!target.isContentEditable && !api.isSearchActive()) {
        e.preventDefault();
        return true;
      }
    }

    // ─── Search Gate ───
    if (api.isSearchActive()) {
      if (e.key === 'Escape' || (isCmd && key === 'G')) {
        e.preventDefault();
        api.setSearchActive(false);
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        api.nextSearch();
        return true;
      }
      // If we are typing in search, let it pass natively
      if (api.isSearchInputFocused(e.target)) return false;
    }

    // ─── Edit Mode Gate ───
    if (!api.isEditing()) {
      // Prevent deletion in view mode
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); return true;
      }
      
      const isPlainKey = !isCmd && !isAlt && !isShift;
      const v = keybindings.content.viewer;
      
      if (isPlainKey && key === v.enterEdit?.toUpperCase()) {
        e.preventDefault(); api.setIsEditing(true); return true;
      } else if (isPlainKey && key === v.moveDown?.toUpperCase()) {
        e.preventDefault(); api.moveCursor('down'); return true;
      } else if (isPlainKey && key === v.moveUp?.toUpperCase()) {
        e.preventDefault(); api.moveCursor('up'); return true;
      } else if (isPlainKey && key === v.moveLeft?.toUpperCase()) {
        e.preventDefault(); api.moveCursor('left'); return true;
      } else if (isPlainKey && key === v.moveRight?.toUpperCase()) {
        e.preventDefault(); api.moveCursor('right'); return true;
      } else if (isPlainKey && e.key === v.search) {
        e.preventDefault();
        api.setSearchActive(true);
        return true;
      }
    }

    // ─── Generic Keys ───
    const g = keybindings.content.generic || {};
    const isMatch = (binding: string | undefined) => isCmd && key === binding?.split('+').pop()?.toUpperCase();

    if (api.isEditing() && (e.key === 'Escape' || (isCmd && key === 'G'))) {
      e.preventDefault(); api.setIsEditing(false); return true;
    } else if (isMatch(g.endOfLine)) {
      e.preventDefault(); api.endOfLine(); return true;
    } else if (isMatch(g.startOfLine)) {
      e.preventDefault(); api.startOfLine(); return true;
    } else if (isMatch(g.killLine)) {
      if (!api.isEditing()) return true;
      e.preventDefault(); api.killLine(); return true;
    } else if (isMatch(g.selectAll)) {
      e.preventDefault(); api.selectAll(); return true;
    } else if (isMatch(g.prevLine)) {
      e.preventDefault(); api.moveCursor('up'); return true;
    } else if (isMatch(g.nextLine)) {
      e.preventDefault(); api.moveCursor('down'); return true;
    } else if (isMatch(g.forwardChar)) {
      e.preventDefault(); api.moveCursor('right'); return true;
    } else if (isMatch(g.backwardChar)) {
      e.preventDefault(); api.moveCursor('left'); return true;
    }

    return false;
  }
}
