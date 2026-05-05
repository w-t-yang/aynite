import { Keybinding } from './types';
import { AppOperation, ViewOperation } from '../../../lib/constants/app';

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
  submit: () => void;
}

export interface SidebarAPI {
  copy: () => void;
  paste: () => void;
  submit: () => void;
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
  deleteForward: () => void;
  selectAll: () => void;
  refresh: () => void;
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

  private static checkMatch(e: KeyboardEvent, kb: Keybinding | undefined): boolean {
    if (!kb) return false;
    const isDarwin = window.navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    return (!!kb.ctrl === (e.ctrlKey || (!isDarwin && e.metaKey))) && 
           (!!kb.meta === (isDarwin ? e.metaKey : false)) &&
           (!!kb.shift === isShift) && 
           (!!kb.alt === isAlt) && 
           e.key.toUpperCase() === kb.key.toUpperCase();
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
    
    if (this.checkMatch(e, kb.app[AppOperation.REFRESH_APP])) { e.preventDefault(); this.globalApi.reload(); return; }
    if (this.checkMatch(e, kb.app[AppOperation.TOGGLE_LEFT_PANEL])) { e.preventDefault(); this.globalApi.toggleLeftPanel(); return; }
    if (this.checkMatch(e, kb.app[AppOperation.TOGGLE_RIGHT_PANEL])) { e.preventDefault(); this.globalApi.toggleRightPanel(); return; }
    if (this.checkMatch(e, kb.app[AppOperation.FOCUS_CHAT])) { e.preventDefault(); this.globalApi.focusChat(); return; }
    if (this.checkMatch(e, kb.app[AppOperation.FOCUS_SKILLS])) { e.preventDefault(); this.globalApi.focusSkills(); return; }
    if (this.checkMatch(e, kb.app[AppOperation.FOCUS_COMMANDS])) { e.preventDefault(); this.globalApi.focusCommands(); return; }
    
    // 2.5 Tab Refresh (Catch early to prevent browser reload)
    if (this.checkMatch(e, kb.view[ViewOperation.REFRESH] || kb.app[AppOperation.REFRESH_APP])) {
      e.preventDefault();
      if (this.activeTabId && this.tabApis.has(this.activeTabId)) {
        this.tabApis.get(this.activeTabId)!.refresh();
      }
      return;
    }

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
    
    if (el && ((el as any) instanceof HTMLElement || (el as any) instanceof Element) && typeof (el as any).closest === 'function') {
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
      if (this.checkMatch(e, kb.app[AppOperation.SUBMIT_CHAT])) {
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
        this.settingsApi.submit();
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
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sidebarApi.submit();
        return;
      }
    }

    if (context === 'editor' && this.activeTabId && this.tabApis.has(this.activeTabId)) {
      const handled = this.handleEditorKeys(e, this.tabApis.get(this.activeTabId)!, kb);
      if (handled) return;
    }
  };

  private static handleEditorKeys = (e: KeyboardEvent, api: EditorAPI, kb: any): boolean => {
    const isCmd = e.metaKey || e.ctrlKey;
    const key = e.key.toUpperCase();

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
      if (api.isSearchInputFocused(e.target)) return false;
    }

    if (!api.isEditing()) {
      if (this.checkMatch(e, kb.view[ViewOperation.MARK_WHOLE_BUFFER])) {
        e.preventDefault();
        api.setIsEditing(true);
        return true;
      }
      
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault(); return true;
      }
      
      const v = kb.view;
      if (this.checkMatch(e, v[ViewOperation.NEXT_LINE])) {
        e.preventDefault(); api.moveCursor('down'); return true;
      } else if (this.checkMatch(e, v[ViewOperation.PREVIOUS_LINE])) {
        e.preventDefault(); api.moveCursor('up'); return true;
      } else if (this.checkMatch(e, v[ViewOperation.BACKWARD_CHAR])) {
        e.preventDefault(); api.moveCursor('left'); return true;
      } else if (this.checkMatch(e, v[ViewOperation.FORWARD_CHAR])) {
        e.preventDefault(); api.moveCursor('right'); return true;
      }
    }

    const v = kb.view;
    if (api.isEditing() && (e.key === 'Escape' || this.checkMatch(e, v[ViewOperation.KEYBOARD_QUIT]))) {
      e.preventDefault(); api.setIsEditing(false); return true;
    } else if (this.checkMatch(e, v[ViewOperation.END_OF_LINE])) {
      e.preventDefault(); api.endOfLine(); return true;
    } else if (this.checkMatch(e, v[ViewOperation.BEGINNING_OF_LINE])) {
      e.preventDefault(); api.startOfLine(); return true;
    } else if (this.checkMatch(e, v[ViewOperation.KILL_LINE])) {
      if (!api.isEditing()) return true;
      e.preventDefault(); api.killLine(); return true;
    } else if (this.checkMatch(e, v[ViewOperation.DELETE_CHAR])) {
      if (!api.isEditing()) return true;
      e.preventDefault(); api.deleteForward(); return true;
    }

    return false;
  };

  private static handleGlobalKeyUp = (e: KeyboardEvent) => {
    // Optional: implement if needed
  };
}
