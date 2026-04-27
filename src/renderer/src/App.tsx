import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Command, MessageSquare, FileText, X, PanelRightClose, PanelRightOpen, Terminal, PanelLeftClose, PanelLeftOpen, Bot } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatTab from './components/Chat';
import SettingsView from './components/Settings';
import FileViewer from './components/FileViewer';
import { SettingsState } from './components/Settings';
import { cn } from './lib/utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Tab = {
  id: string;
  type: 'file' | 'settings';
  title: string;
  content?: string;
  filepath?: string;
  originalContent?: string;
  isDirty?: boolean;
};

const DEFAULT_SETTINGS: SettingsState = {
  theme: 'dark',
  aiProvider: 'gemini',
  keybindings: {
    commandTab: 'META+X',
    chatTab: 'META+Y',
    closeTab: 'CTRL+W',
    viewMode: {
      enterEdit: 'A',
      moveDown: 'J',
      moveUp: 'K',
      moveLeft: 'H',
      moveRight: 'L',
      search: '/'
    },
    editMode: {
      exitEdit: 'ESCAPE',
      endOfLine: 'CTRL+E',
      startOfLine: 'CTRL+A',
      killLine: 'CTRL+K',
      copy: 'CTRL+C',
      paste: 'CTRL+V',
      selectAll: 'CTRL+Q',
      cut: 'CTRL+X',
      prevLine: 'CTRL+P',
      nextLine: 'CTRL+N',
      forwardChar: 'CTRL+F',
      backwardChar: 'CTRL+B'
    }
  }
};

export default function App() {
  const [settings, setSettings] = useState<SettingsState | null>(null);

  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [tabs, setTabs] = useState<Tab[]>([]);

  const loadWorkspaceState = async () => {
    // @ts-ignore
    const res = await window.api.getWorkspaceState();
    if (res && res.data) {
      const restoredTabs = res.data.tabs || [];
      const validTabs: Tab[] = [];

      for (const tab of restoredTabs) {
        if (tab.type === 'file' && tab.filepath) {
          // @ts-ignore
          const fRes = await window.api.readFile(tab.filepath);
          if (fRes && !fRes.error) {
             validTabs.push({ ...tab, content: fRes.data, originalContent: fRes.data, isDirty: false });
          }
        } else {
          validTabs.push(tab);
        }
      }

      setTabs(validTabs);
      const restoredActiveId = res.data.activeTabId;
      setActiveTabId(validTabs.find(t => t.id === restoredActiveId) ? restoredActiveId : (validTabs.length > 0 ? validTabs[validTabs.length - 1].id : ''));
    }
    setWorkspaceReady(true);
  };

  useEffect(() => {
    // @ts-ignore
    window.api.loadConfig().then((res: any) => {
      if (res.data) setSettings(res.data);
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

  const startResizingLeft = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftWidth(Math.max(150, Math.min(newWidth, 800)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [leftWidth]);

  const startResizingRight = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth - (moveEvent.clientX - startX);
      setRightWidth(Math.max(250, Math.min(newWidth, 1200)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [rightWidth]);

  const handleFileContentChange = (content: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, content, isDirty: content !== tab.originalContent } 
        : tab
    ));
  };

  const handleSaveActiveTab = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab?.type === 'file' && activeTab.filepath && activeTab.isDirty) {
      // @ts-ignore
      await window.api.saveFile(activeTab.filepath, activeTab.content || '');
      setTabs(prev => prev.map(tab => 
        tab.id === activeTabId
          ? { ...tab, isDirty: false, originalContent: activeTab.content }
          : tab
      ));
    }
  };

  useEffect(() => {
    if (!settings) return;
    // @ts-ignore
    window.api.saveConfig(settings);
    document.documentElement.classList.remove('dark', 'nord', 'solarized');
    if (settings.theme !== 'light') {
      document.documentElement.classList.add(settings.theme);
    }
  }, [settings]);

  useEffect(() => {
    if (!workspaceReady) return;
    const strippedTabs = tabs.map(t => {
      const { content, originalContent, isDirty, ...rest } = t;
      return rest;
    });
    // @ts-ignore
    window.api.saveWorkspaceState(strippedTabs, activeTabId).catch(console.error);
  }, [activeTabId, tabs, workspaceReady]);

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
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const key = e.key.toUpperCase();
      
      if (!settings) return;

      if (isMeta && key === 'S') {
        e.preventDefault();
        handleSaveActiveTab();
      }

      if (settings?.keybindings?.closeTab) {
        const closeMatch = settings.keybindings.closeTab.toUpperCase().split('+');
        const isCloseMeta = (closeMatch.includes('CTRL') || closeMatch.includes('META')) ? (e.ctrlKey || e.metaKey) : true;
        if (isCloseMeta && key === closeMatch[closeMatch.length - 1]) {
           if (activeTabId) {
             e.preventDefault();
             closeTab({ stopPropagation: () => {} } as any, activeTabId);
           }
        }
      }
      
      const cmdMatch = settings.keybindings.commandTab.toUpperCase().split('+');
      const chatMatch = settings.keybindings.chatTab.toUpperCase().split('+');

      if (isMeta && (cmdMatch.includes('META') || cmdMatch.includes('CTRL'))) {
        if (key === cmdMatch[cmdMatch.length - 1]) {
          e.preventDefault();
          setRightPanelOpen(true);
          setTimeout(() => (window as any).focusChatInput?.(), 50);
        }
      }

      if (isMeta && (chatMatch.includes('META') || chatMatch.includes('CTRL'))) {
        if (key === chatMatch[chatMatch.length - 1]) {
          e.preventDefault();
          setRightPanelOpen(true);
          setTimeout(() => (window as any).focusChatInput?.(), 50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings, tabs, activeTabId]);

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

  const handleSelectFile = (file: { name: string; path: string }, content: string) => {
    const tabId = `file-${file.path}`;
    if (!tabs.find(t => t.id === tabId)) {
      setTabs(prev => [...prev, {
        id: tabId,
        type: 'file',
        title: file.name,
        filepath: file.path,
        content,
        originalContent: content,
        isDirty: false
      }]);
    }
    setActiveTabId(tabId);
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

  const activeTab = tabs.find(t => t.id === activeTabId);

  if (!settings) {
    return <div className="h-screen w-full bg-background flex items-center justify-center text-muted-foreground">Loading configs...</div>;
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar Wrapper */}
      {leftPanelOpen && (
        <div className="relative shrink-0 flex" style={{ width: leftWidth }}>
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
            className="w-1 cursor-col-resize hover:bg-blue-500/50 bg-transparent flex-shrink-0 z-20 transition-colors h-full absolute -right-0.5 top-0"
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
                  activeTabId === tab.id ? "bg-background text-foreground before:absolute before:top-0 before:inset-x-0 before:h-0.5 before:bg-blue-500" : "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
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
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative bg-background">
          {tabs.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground opacity-60">
              <Terminal size={48} className="mb-4 opacity-50 text-blue-500" />
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
        <div className="relative shrink-0 flex" style={{ width: rightWidth }}>
          <div 
            className="w-1 cursor-col-resize hover:bg-blue-500/50 bg-transparent flex-shrink-0 z-20 transition-colors h-full absolute -left-0.5 top-0"
            onMouseDown={startResizingRight}
          />
          <div className="flex-1 w-full h-full flex flex-col border-l border-border bg-background min-w-0 overflow-hidden">
            <div className="flex items-center justify-between h-10 border-b border-border bg-muted/30 px-3 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground opacity-80">
                 <Bot size={16} /> AI Agent
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
              <ChatTab />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

