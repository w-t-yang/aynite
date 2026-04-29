import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Command, MessageSquare, FileText, X, PanelRightClose, PanelRightOpen, Terminal, PanelLeftClose, PanelLeftOpen, Bot, MoreHorizontal, Eraser } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatTab from './components/Chat';
import SettingsView from './components/Settings';
import FileViewer from './components/FileViewer';
import TabSwitcher from './components/TabSwitcher';
import { SettingsState } from './components/Settings';
import { cn } from './lib/utils';
import { getFileCategory } from './lib/file-handlers';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { KeyManager } from './lib/key-handlers';

type Tab = {
  id: string;
  type: 'file' | 'settings';
  title: string;
  content?: string;
  filepath?: string;
  originalContent?: string;
  isDirty?: boolean;
  cursorPos?: number;
};

const DEFAULT_SETTINGS: SettingsState = {
  activeTheme: 'dark',
  aiProvider: 'gemini',
  keybindings: {
    global: {
      refresh: 'CTRL+SHIFT+R',
      quit: ''
    },
    explorer: {
      toggleLeftPanel: 'CTRL+T'
    },
    agent: {
      focusChat: 'CTRL+I',
      focusSkills: 'CTRL+/',
      focusCommands: 'CTRL+.',
      toggleRightPanel: 'CTRL+U'
    },
    content: {
      navigation: {
        switchTab: 'CTRL+TAB',
        closeTab: 'CTRL+W',
        focusContent: 'CTRL+Y'
      },
      viewer: {
        enterEdit: 'A',
        moveDown: 'J',
        moveUp: 'K',
        moveLeft: 'H',
        moveRight: 'L',
        search: '/',
        refresh: 'CTRL+R'
      },
      generic: {
        exitEdit: 'ESCAPE',
        endOfLine: 'CTRL+E',
        startOfLine: 'CTRL+A',
        killLine: 'CTRL+K',
        selectAll: 'CTRL+Q',
        deleteForward: 'CTRL+D',
        cut: 'CTRL+X',
        copy: 'CTRL+C',
        paste: 'CTRL+V',
        prevLine: 'CTRL+P',
        nextLine: 'CTRL+N',
        forwardChar: 'CTRL+F',
        backwardChar: 'CTRL+B'
      }
    }
  },
  prompts: {
    files: []
  }
};

export default function App() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [activeThemeData, setActiveThemeData] = useState<any>(null);

  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([]);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string>('');
  const [showTabSwitcher, setShowTabSwitcher] = useState(false);
  const [showTabMenu, setShowTabMenu] = useState(false);
  const tabMenuRef = useRef<HTMLDivElement>(null);

  const loadWorkspaceState = async () => {
    setWorkspaceReady(false);
    // @ts-ignore
    const res = await window.api.getWorkspaceState();
    if (res && res.data) {
      setActiveWorkspaceName(res.data.name || '');
      const restoredTabs = res.data.tabs || [];
      const validTabs: Tab[] = [];

      for (const tab of restoredTabs) {
        if (tab.type === 'file' && tab.filepath) {
          const ext = tab.filepath.split('.').pop() || '';
          const category = getFileCategory(ext);
          
          if (category === 'text' || category === 'markdown' || category === 'html') {
            // @ts-ignore
            const fRes = await window.api.readFile(tab.filepath);
            if (fRes && !fRes.error) {
               validTabs.push({ ...tab, content: fRes.data, originalContent: fRes.data, isDirty: false });
            }
          } else {
             validTabs.push({ ...tab, content: '', originalContent: '', isDirty: false });
          }
        } else {
          validTabs.push(tab);
        }
      }

      setTabs(validTabs);
      const restoredActiveId = res.data.activeTabId;
      setActiveTabId(validTabs.find(t => t.id === restoredActiveId) ? restoredActiveId : (validTabs.length > 0 ? validTabs[validTabs.length - 1].id : ''));
      
      // Focus the editor if a tab is active
      setTimeout(() => {
        const textarea = document.querySelector('textarea[track-cursor="true"]') as HTMLTextAreaElement;
        if (textarea) textarea.focus();
      }, 300);
    }
    
    // Load workspace folders for the chat agent
    // @ts-ignore
    const foldersRes = await window.api.getWorkspaceFolders();
    if (foldersRes && Array.isArray(foldersRes.data)) {
      setWorkspaceFolders(foldersRes.data);
    }

    setWorkspaceReady(true);
  };

  // Migrate old settings structure to new one
  const migrateSettings = (loaded: any): SettingsState => {
    const kb = loaded.keybindings || {};
    
    // If the old structure is detected, convert it
    if (!kb.global) {
      const oldKb = { ...kb };
      kb.global = {
        refresh: 'CTRL+SHIFT+R',
        toggleLeftPanel: 'CTRL+T',
        toggleRightPanel: 'CTRL+U',
        quit: 'CTRL+Q'
      };
      kb.explorer = {};
      kb.agent = {
        focusChat: oldKb.startChat || 'CTRL+I'
      };
      kb.content = {
        navigation: {
          switchTab: oldKb.switchTab || 'CTRL+TAB',
          closeTab: oldKb.closeTab || 'CTRL+W',
          focusContent: 'CTRL+Y'
        },
        viewer: oldKb.viewMode || {
          enterEdit: 'A', moveDown: 'J', moveUp: 'K', moveLeft: 'H', moveRight: 'L', search: '/'
        },
        generic: oldKb.contentKeys || {
          exitEdit: 'ESCAPE', endOfLine: 'CTRL+E', startOfLine: 'CTRL+A', killLine: 'CTRL+K', selectAll: 'CTRL+Z', deleteForward: 'CTRL+D', cut: 'CTRL+X', copy: 'CTRL+C', paste: 'CTRL+V', prevLine: 'CTRL+P', nextLine: 'CTRL+N', forwardChar: 'CTRL+F', backwardChar: 'CTRL+B'
        }
      };

      // Clean up old keys
      delete kb.startChat;
      delete kb.switchTab;
      delete kb.closeTab;
      delete kb.viewMode;
      delete kb.contentKeys;
      delete kb.editMode;
    }

    // Force migrate old refresh key if it's the old default to avoid app-reload on Ctrl+R
    if (kb.global?.refresh === 'CTRL+R') {
      kb.global.refresh = 'CTRL+SHIFT+R';
    }
    if (kb.content?.viewer && !kb.content.viewer.refresh) {
      kb.content.viewer.refresh = 'CTRL+R';
    }

    // Strip removed CTRL keys from viewer if they still exist in some old configs
    if (kb.content?.viewer) {
      const { prevLine, nextLine, forwardChar, backwardChar, startOfLine, endOfLine, ...cleanViewer } = kb.content.viewer;
      kb.content.viewer = cleanViewer;
    }

    // Deep merge with defaults to fill any missing keys
    if (loaded.theme && !loaded.activeTheme) {
      loaded.activeTheme = loaded.theme;
      delete loaded.theme;
    }

    const aiConfigs = loaded.aiConfigs || {};
    if (aiConfigs.autoApproveCommands !== undefined) {
      delete aiConfigs.autoApproveCommands;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...loaded,
      aiConfigs,
      activeTheme: loaded.activeTheme || DEFAULT_SETTINGS.activeTheme,
      keybindings: {
        ...DEFAULT_SETTINGS.keybindings,
        ...kb,
        global: { ...DEFAULT_SETTINGS.keybindings.global, ...(kb.global || {}) },
        content: {
          ...DEFAULT_SETTINGS.keybindings.content,
          ...(kb.content || {}),
          navigation: { ...DEFAULT_SETTINGS.keybindings.content.navigation, ...(kb.content?.navigation || {}) },
          viewer: { ...DEFAULT_SETTINGS.keybindings.content.viewer, ...(kb.content?.viewer || {}) },
          generic: { ...DEFAULT_SETTINGS.keybindings.content.generic, ...(kb.content?.generic || {}) },
        }
      },
      prompts: loaded.prompts || DEFAULT_SETTINGS.prompts
    };
  };

  useEffect(() => {
    // @ts-ignore
    window.api.loadConfig().then((res: any) => {
      if (res.data) setSettings(migrateSettings(res.data));
      else setSettings(DEFAULT_SETTINGS);
    }).catch(() => setSettings(DEFAULT_SETTINGS));
    
    loadWorkspaceState();
  }, []);

  const [rightPanelOpen, setRightPanelOpen] = useState(() => {
    return localStorage.getItem('obsidian_right_panel') !== 'false';
  });

  const [leftPanelOpen, setLeftPanelOpen] = useState(() => {
    return localStorage.getItem('obsidian_left_panel') !== 'false';
  });

  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem('obsidian_left_width');
    return saved ? parseInt(saved, 10) : 256;
  });

  const [rightWidth, setRightWidth] = useState(() => {
    const saved = localStorage.getItem('obsidian_right_width');
    return saved ? parseInt(saved, 10) : 640;
  });

  const tabsRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const handleTabsWheel = (e: React.WheelEvent) => {
    if (tabsRef.current) {
      tabsRef.current.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    localStorage.setItem('obsidian_left_width', leftWidth.toString());
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem('obsidian_right_width', rightWidth.toString());
  }, [rightWidth]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setShowTabMenu(false);
      }
    };
    if (showTabMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTabMenu]);

  const startResizingLeft = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;
    let finalWidth = startWidth;
    document.body.classList.add('resizing');

    function onMouseMove(moveEvent: MouseEvent) {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      finalWidth = Math.max(150, Math.min(newWidth, 800));
      if (leftPanelRef.current) {
        leftPanelRef.current.style.width = `${finalWidth}px`;
      }
    }

    function onMouseUp() {
      cleanup();
    }

    function onKeyDown(ke: KeyboardEvent) {
      if (ke.key === 'Escape' || (ke.ctrlKey && ke.key.toLowerCase() === 'g')) {
        cleanup();
      }
    }

    function cleanup() {
      document.body.classList.remove('resizing');
      setLeftWidth(finalWidth);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }, [leftWidth]);

  const startResizingRight = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;
    let finalWidth = startWidth;
    document.body.classList.add('resizing');

    function onMouseMove(moveEvent: MouseEvent) {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      finalWidth = Math.max(250, Math.min(newWidth, 1200));
      if (rightPanelRef.current) {
        rightPanelRef.current.style.width = `${finalWidth}px`;
      }
    }

    function onMouseUp() {
      cleanup();
    }

    function onKeyDown(ke: KeyboardEvent) {
      if (ke.key === 'Escape' || (ke.ctrlKey && ke.key.toLowerCase() === 'g')) {
        cleanup();
      }
    }

    function cleanup() {
      document.body.classList.remove('resizing');
      setRightWidth(finalWidth);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
  }, [rightWidth]);

  const handleFileContentChange = (content: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, content, isDirty: content !== tab.originalContent } 
        : tab
    ));
  };

  const handleFileRefresh = (content: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, content, originalContent: content, isDirty: false } 
        : tab
    ));
  };

  const handleCursorChange = (cursorPos: number) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, cursorPos } 
        : tab
    ));
  };

  const handleSaveActiveTab = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab?.type === 'file' && activeTab.filepath && activeTab.isDirty) {
      // Notify components that we're about to save to ignore the FS change event
      window.dispatchEvent(new CustomEvent('file-saving', { detail: activeTab.filepath }));
      
      // @ts-ignore
      await window.api.saveFile(activeTab.filepath, activeTab.content || '');
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId
          ? { ...tab, isDirty: false, originalContent: activeTab.content }
          : tab
      ));
    }
  };

  // Camel-case key to CSS custom property name (e.g. cardForeground -> --card-foreground)
  const toCSSVar = (key: string): string => {
    return '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
  };

  const applyThemeColors = (colors: Record<string, string>) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(toCSSVar(key), value);
    }
  };

  const loadAndApplyTheme = async (themeName: string) => {
    try {
      // @ts-ignore
      const res = await window.api.getTheme(themeName);
      if (res?.data?.colors) {
        setActiveThemeData(res.data);
        applyThemeColors(res.data.colors);
        // Apply font properties
        if (res.data.fonts) {
          const root = document.documentElement;
          if (res.data.fonts.fontFamily) root.style.setProperty('--font-sans', res.data.fonts.fontFamily);
          if (res.data.fonts.fontMono) root.style.setProperty('--font-mono', res.data.fonts.fontMono);
          if (res.data.fonts.fontSize) root.style.setProperty('--font-size-base', res.data.fonts.fontSize);
          root.style.fontSize = res.data.fonts.fontSize || '14px';
        }
      }
    } catch (e) {
      console.error('Failed to load theme:', e);
    }
  };

  useEffect(() => {
    if (!settings) return;
    // @ts-ignore
    window.api.saveConfig(settings);
    loadAndApplyTheme(settings.activeTheme);
  }, [settings]);

  useEffect(() => {
    if (!workspaceReady || !activeWorkspaceName) return;
    
    const timer = setTimeout(() => {
      const strippedTabs = tabs.map(t => {
        const { content, originalContent, isDirty, ...rest } = t;
        return rest;
      });
      // @ts-ignore
      window.api.saveWorkspaceState(activeWorkspaceName, strippedTabs, activeTabId).catch(console.error);
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [activeTabId, tabs, workspaceReady, activeWorkspaceName]);

  useEffect(() => {
    localStorage.setItem('obsidian_right_panel', String(rightPanelOpen));
  }, [rightPanelOpen]);

  useEffect(() => {
    localStorage.setItem('obsidian_left_panel', String(leftPanelOpen));
  }, [leftPanelOpen]);

  useEffect(() => {
    if (activeTabId && tabs.length > 0) {
      const tabEl = document.getElementById(`tab-${activeTabId}`);
      if (tabEl) {
        tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      // Force focus to the new tab content
      setTimeout(() => {
        // Try to focus standard editor
        const textarea = document.querySelector('textarea[track-cursor="true"]') as HTMLElement;
        if (textarea) {
          textarea.focus();
          return;
        }

        // Try to focus specialized viewer iframe
        const iframes = document.querySelectorAll('iframe');
        if (iframes.length > 0) {
           // The active one is usually the only one visible or the last one mounted
           const activeIframe = iframes[iframes.length - 1];
           try {
             activeIframe.contentWindow?.document.body.focus();
           } catch (e) {
             activeIframe.focus();
           }
           return;
        }

        // Fallback to settings panel
        const settingsPanel = document.querySelector('.settings-panel') as HTMLElement;
        if (settingsPanel) settingsPanel.focus();
      }, 150);
    }
  }, [activeTabId]);

  useEffect(() => {
    // @ts-ignore
    const unsubscribe = window.api.onFileSystemChange(({ event, path }) => {
      if (event === 'unlink' || event === 'unlinkDir') {
        window.dispatchEvent(new CustomEvent('file-deleted', { detail: path }));
      }
      // Note: renames are unlink + add. 
      // If we want to support smooth rename transitions from external sources, 
      // we'd need more complex tracking. For now, unlink will safely close the tab.
    });

    // Initialize KeyManager
    const globalApi = {
      saveActiveTab: handleSaveActiveTab,
      reload: () => window.location.reload(),
      toggleLeftPanel: () => setLeftPanelOpen(prev => !prev),
      toggleRightPanel: () => setRightPanelOpen(prev => !prev),
      focusChat: () => { setRightPanelOpen(true); setTimeout(() => (window as any).focusChatInput?.(), 150); },
      focusSkills: () => { setRightPanelOpen(true); setTimeout(() => (window as any).focusChatInput?.('/'), 150); },
      focusCommands: () => { setRightPanelOpen(true); setTimeout(() => (window as any).focusChatInput?.('>'), 150); },
      closeTab: () => { if (activeTabId) closeTab({ stopPropagation: () => {} } as any, activeTabId); },
      switchTab: () => setShowTabSwitcher(true),
      focusContent: () => (document.querySelector('textarea[track-cursor="true"]') as HTMLElement)?.focus(),
      closeTabSwitcher: () => setShowTabSwitcher(false),
      isTabSwitcherOpen: () => showTabSwitcher,
    };

    if (settings) {
      KeyManager.init(settings, globalApi);
      KeyManager.setActiveTab(activeTabId);
    }

    return () => {
      unsubscribe();
      KeyManager.cleanup();
    };
  }, [settings, tabs, activeTabId, showTabSwitcher]);

  useEffect(() => {
    const handleFileDeleted = (e: any) => {
      const p = e.detail;
      const newTabs = tabs.filter(t => !t.filepath || (t.filepath !== p && !t.filepath.startsWith(p + '/')));
      setTabs(newTabs);
      
      const activeT = tabs.find(t => t.id === activeTabId);
      if (activeT?.filepath && (activeT.filepath === p || activeT.filepath.startsWith(p + '/'))) {
        if (newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1].id);
        else setActiveTabId('');
      }
    };
    
    const handleFileRenamed = (e: any) => {
      const { oldPath, newPath } = e.detail;
      let updatedActiveId = activeTabId;

      const newTabs = tabs.map(t => {
        if (t.filepath === oldPath) {
          const newName = newPath.split(/[\/\\]/).pop() || newPath;
          const newId = `file-${newPath}`;
          if (activeTabId === t.id) updatedActiveId = newId;
          return { ...t, id: newId, title: newName, filepath: newPath };
        } else if (t.filepath && t.filepath.startsWith(oldPath + '/')) {
          const newChildPath = newPath + t.filepath.substring(oldPath.length);
          const newId = `file-${newChildPath}`;
          if (activeTabId === t.id) updatedActiveId = newId;
          return { ...t, id: newId, filepath: newChildPath };
        }
        return t;
      });
      
      setTabs(newTabs);
      if (updatedActiveId !== activeTabId) setActiveTabId(updatedActiveId);
    };

    window.addEventListener('file-deleted', handleFileDeleted);
    window.addEventListener('file-renamed', handleFileRenamed);
    return () => {
      window.removeEventListener('file-deleted', handleFileDeleted);
      window.removeEventListener('file-renamed', handleFileRenamed);
    };
  }, [tabs, activeTabId]);

  const handleSelectFile = async (file: { name: string; path: string, isDirectory: boolean }) => {
    // Normalize path to ensure tab reuse works across platforms/sources
    const normalizedPath = file.path.replace(/\\/g, '/');
    const tabId = `file-${normalizedPath}`;
    
    // Check if a tab with this normalized path already exists
    const existingTab = tabs.find(t => t.filepath?.replace(/\\/g, '/') === normalizedPath);
    
    if (!existingTab) {
      // @ts-ignore
      const infoRes = await window.api.getFileInfo(file.path);
      const info = infoRes.data || {};
      // @ts-ignore
      const category = getFileCategory(info.extension || '', info.isText, info.path || file.path);
      let content = '';

      // Safety: Only read if it's a supported text type and under 10MB
      const MAX_TEXT_SIZE = 10 * 1024 * 1024; // 10MB
      const isLarge = (info.size || 0) > MAX_TEXT_SIZE;
      const isTextType = category === 'text' || category === 'markdown' || category === 'html';

      if (isTextType && !isLarge && info.isText !== false) {
        // @ts-ignore
        const res = await window.api.readFile(file.path);
        content = res.data || '';
      }

      setTabs(prev => [...prev, {
        id: tabId,
        type: 'file',
        title: file.name,
        filepath: file.path, // Store original path for saving
        content,
        originalContent: content,
        isDirty: false,
        size: info.size
      }]);
      setActiveTabId(tabId);
    } else {
      setActiveTabId(existingTab.id);
    }

    // Focus the editor after a selection (sidebar or elsewhere)
    setTimeout(() => {
      const textarea = document.querySelector('textarea[track-cursor="true"]') as HTMLTextAreaElement;
      if (textarea) textarea.focus();
    }, 200);
  };

  const openSettings = () => {
    if (!tabs.find(t => t.id === 'settings')) {
      setTabs(prev => [...prev, { id: 'settings', type: 'settings', title: 'Settings' }]);
    }
    setActiveTabId('settings');
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    } else if (newTabs.length === 0) {
      setActiveTabId('');
    }
  };

  const closeAllTabs = () => {
    setTabs([]);
    setActiveTabId('');
    setShowTabMenu(false);
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  if (!settings) {
    return <div className="h-screen w-full bg-background flex items-center justify-center text-muted-foreground">Loading configs...</div>;
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar Wrapper */}
      {leftPanelOpen && (
        <div ref={leftPanelRef} className="relative shrink-0 flex will-change-width" style={{ width: leftWidth }}>
          <div className="flex-1 overflow-hidden min-w-0">
            <Sidebar 
              activeTabPath={activeTab?.filepath}
              onWorkspaceChange={loadWorkspaceState}
              onSelectFile={handleSelectFile} 
              onOpenSettings={openSettings} 
              onClose={() => setLeftPanelOpen(false)} 
              dirtyFiles={tabs.filter(t => t.isDirty && t.filepath).map(t => t.filepath as string)}
            />
          </div>
          <div 
            className="w-1 cursor-col-resize hover:bg-primary/50 bg-transparent flex-shrink-0 z-20 transition-colors h-full absolute -right-0.5 top-0"
            onMouseDown={startResizingLeft}
          />
        </div>
      )}

      {!leftPanelOpen && (
        <div className="w-10 border-r border-border flex flex-col items-center py-2 shrink-0 bg-sidebar/50">
          <button 
            onClick={() => setLeftPanelOpen(true)}
            title="Open Explorer"
            className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <PanelLeftOpen size={18} />
          </button>
          <div className="flex-1" />
          <button 
            onClick={openSettings}
            title="Settings"
            className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        
        {/* Tab Bar */}
        <div className="flex items-center h-10 border-b border-border bg-muted/30 shrink-0">
          {/* Scrollable Tabs */}
          <div 
            ref={tabsRef}
            onWheel={handleTabsWheel}
            className="flex-1 flex overflow-x-auto overflow-y-hidden no-scrollbar h-full scroll-smooth"
          >
            {tabs.map((tab) => (
              <div 
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "group flex items-center h-full px-4 border-r border-border cursor-pointer select-none min-w-[120px] max-w-[240px] transition-colors relative shrink-0",
                  activeTabId === tab.id ? "bg-background text-foreground before:absolute before:top-0 before:inset-x-0 before:h-0.5 before:bg-tab-active-border" : "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {tab.type === 'file' && <FileText size={14} className="mr-2 shrink-0" />}
                {tab.type === 'settings' && <SettingsIcon size={14} className="mr-2 shrink-0" />}
                <span className={cn("truncate text-sm font-medium", tab.isDirty && "italic")}>
                   {tab.title}{tab.isDirty && " •"}
                </span>
                
                <button 
                  onClick={(e) => closeTab(e, tab.id)}
                  className={cn(
                    "ml-auto p-0.5 rounded-sm hover:bg-accent-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity",
                    activeTabId === tab.id ? "opacity-100" : ""
                  )}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Tab Menu Trigger */}
          <div className="relative shrink-0 flex items-center px-2 h-full border-l border-border" ref={tabMenuRef}>
            <button
              onClick={() => setShowTabMenu(!showTabMenu)}
              className={cn(
                "p-1 rounded-md transition-all hover:bg-accent text-muted-foreground hover:text-foreground",
                showTabMenu && "bg-accent text-foreground"
              )}
              title="Tab Actions"
            >
              <MoreHorizontal size={18} />
            </button>

            {showTabMenu && (
              <div className="absolute top-full right-2 mt-1 w-48 bg-popover border border-border rounded-lg shadow-2xl z-[100] py-1 animate-in fade-in slide-in-from-top-1">
                <button
                  onClick={closeAllTabs}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors text-left"
                >
                  <Eraser size={14} className="text-muted-foreground" />
                  <span>Close all tabs</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative bg-background">
          {tabs.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <Terminal size={48} className="mb-4 opacity-50 text-primary" />
              <p>Select a file to open or press Meta+X for terminal</p>
            </div>
          ) : (
            <>
              {activeTab?.type === 'settings' && (
                <div className="absolute inset-0 z-10 bg-background overflow-hidden">
                  <SettingsView settings={settings} onSave={setSettings} onClose={() => closeTab({ stopPropagation: () => {} } as any, 'settings')} />
                </div>
              )}
              
              {activeTab?.type === 'file' && (
                <div className="absolute inset-0 z-10 bg-background overflow-hidden flex flex-col">
                  <FileViewer 
                    filename={activeTab.title} 
                    content={activeTab.content || ''} 
                    onChange={handleFileContentChange}
                    onSave={handleSaveActiveTab}
                    isDirty={activeTab.isDirty}
                    keybindings={settings.keybindings}
                    initialCursorPos={activeTab.cursorPos}
                    onCursorChange={handleCursorChange}
                    onRefresh={handleFileRefresh}
                    id={activeTab.id}
                    key={activeTab.id}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!rightPanelOpen && (
        <div className="w-10 border-l border-border flex flex-col items-center py-2 shrink-0 bg-sidebar/50">
          <button 
            onClick={() => setRightPanelOpen(true)}
            title="Open Right Panel"
            className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <PanelRightOpen size={18} />
          </button>
        </div>
      )}

      {/* Right Panel Wrapper */}
      {rightPanelOpen && (
        <div ref={rightPanelRef} className="relative shrink-0 flex will-change-width" style={{ width: rightWidth }}>
          <div 
            className="w-1 cursor-col-resize hover:bg-primary/50 bg-transparent flex-shrink-0 z-20 transition-colors h-full absolute -left-0.5 top-0"
            onMouseDown={startResizingRight}
          />
          <div className="flex-1 w-full h-full flex flex-col border-l border-border bg-background min-w-0 overflow-hidden">
            <div className="flex items-center justify-between h-10 border-b border-border bg-muted/30 px-3 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground opacity-80">
                 <Bot size={16} /> Aynite Assistant
              </div>
              <button 
                 onClick={() => setRightPanelOpen(false)}
                 className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                 title="Close Panel"
               >
                 <PanelRightClose size={16} />
               </button>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-background">
              <ChatTab 
                settings={settings} 
                workspaceFolders={workspaceFolders} 
                onOpenFile={handleSelectFile}
                activeTabPath={activeTab?.filepath}
              />
            </div>
          </div>
        </div>
      )}
      {showTabSwitcher && (
        <TabSwitcher
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={(id) => {
            setActiveTabId(id);
            setTimeout(() => {
              const textarea = document.querySelector('textarea[track-cursor="true"]') as HTMLTextAreaElement;
              if (textarea) textarea.focus();
            }, 200);
          }}
          onOpenFile={handleSelectFile}
          onClose={() => setShowTabSwitcher(false)}
        />
      )}
    </div>
  );
}

