import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Moon, Sun, Keyboard, Bot, BrainCircuit, Plus, Trash2, RotateCcw, Terminal, Palette, Copy, ChevronDown, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { SearchableSelect } from './ui/SearchableSelect';
import { KeyManager } from '../lib/key-handlers';

export interface SettingsState {
  activeTheme: string;
  aiProvider?: 'gemini' | 'deepseek' | 'ollama';
  skills?: {
    folders: string[];
  };
  commands?: {
    folders: string[];
  };
  aiConfigs?: {
    gemini?: { apiKey: string; url: string };
    deepseek?: { apiKey: string; url: string };
    ollama?: { url: string; model: string; contextWindow: number };
    autoApproveCommands?: boolean;
  };
  keybindings: {
    global: {
      refresh: string;
      quit: string;
    };
    explorer: {
      toggleLeftPanel: string;
    };
    agent: {
      focusChat: string;
      focusSkills: string;
      focusCommands: string;
      toggleRightPanel: string;
    };
    content: {
      navigation: {
        switchTab: string;
        closeTab: string;
        focusContent: string;
      };
      viewer: {
        enterEdit: string;
        moveDown: string;
        moveUp: string;
        moveLeft: string;
        moveRight: string;
        search: string;
      };
      generic: {
        exitEdit: string;
        endOfLine: string;
        startOfLine: string;
        killLine: string;
        selectAll: string;
        deleteForward: string;
        cut: string;
        copy: string;
        paste: string;
        prevLine: string;
        nextLine: string;
        forwardChar: string;
        backwardChar: string;
      };
    };
  };
}

interface SettingsProps {
  settings: SettingsState;
  onSave: (settings: SettingsState) => void;
  onClose: () => void;
}

const COLOR_LABELS: Record<string, string> = {
  background: 'Background', foreground: 'Foreground', sidebar: 'Sidebar',
  card: 'Card', cardForeground: 'Card Text', popover: 'Popover', popoverForeground: 'Popover Text',
  primary: 'Primary', primaryForeground: 'Primary Text',
  secondary: 'Secondary', secondaryForeground: 'Secondary Text',
  muted: 'Muted', mutedForeground: 'Muted Text',
  accent: 'Accent', accentForeground: 'Accent Text',
  destructive: 'Destructive', destructiveForeground: 'Destructive Text',
  border: 'Border', input: 'Input', ring: 'Focus Ring',
  selection: 'Selection', selectionForeground: 'Selection Text',
  link: 'Link', success: 'Success', successForeground: 'Success Text',
  warning: 'Warning', warningForeground: 'Warning Text',
  info: 'Info', infoForeground: 'Info Text',
  tabActive: 'Active Tab', tabActiveBorder: 'Active Tab Border',
  scrollbarThumb: 'Scrollbar', scrollbarTrack: 'Scrollbar Track',
};

export default function Settings({ settings, onSave, onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'keybindings' | 'ai' | 'skills' | 'commands'>('appearance');
  const [localSettings, setLocalSettings] = useState<SettingsState>(settings);

  // Appearance State
  const [themes, setThemes] = useState<any[]>([]);
  const [editingTheme, setEditingTheme] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const saveTimerRef = useRef<any>(null);

  useEffect(() => {
    // Ensure aiConfigs is initialized
    if (!settings.aiConfigs) {
      setLocalSettings(prev => ({
        ...prev,
        aiConfigs: {
          gemini: { apiKey: '', url: '' },
          deepseek: { apiKey: '', url: '' },
          ollama: { url: 'http://localhost:11434', model: 'gemma:e4b', contextWindow: 8192 }
        }
      }));
    } else {
      setLocalSettings(settings);
    }
  }, [settings]);

  const save = (newSettings: SettingsState) => {
    setLocalSettings(newSettings);
    onSave(newSettings);
  };

  const handleKeybindingChange = (group: string, type: string, value: string) => {
    const keys = value.toUpperCase();
    save({
      ...localSettings,
      keybindings: {
        ...localSettings.keybindings,
        [group]: {
          // @ts-ignore
          ...(localSettings.keybindings[group] || {}),
          [type]: keys
        }
      }
    });
  };

  const handleKeybindingChangeNested = (group: string, subGroup: string, type: string, value: string) => {
    const keys = value.toUpperCase();
    save({
      ...localSettings,
      keybindings: {
        ...localSettings.keybindings,
        // @ts-ignore
        [group]: {
          // @ts-ignore
          ...(localSettings.keybindings[group] || {}),
          [subGroup]: {
            // @ts-ignore
            ...(localSettings.keybindings[group]?.[subGroup] || {}),
            [type]: keys
          }
        }
      }
    });
  };

  const handleAiConfigChange = (provider: 'gemini' | 'deepseek' | 'ollama', field: string, value: any) => {
    const newConfigs = { ...localSettings.aiConfigs } as any;
    if (!newConfigs[provider]) {
      newConfigs[provider] = provider === 'ollama' ? { url: 'http://localhost:11434', model: 'gemma:e4b', contextWindow: 8192 } : { apiKey: '', url: '' };
    }
    
    if (field === 'contextWindow') {
      newConfigs[provider][field] = parseInt(value, 10) || 8192;
    } else {
      newConfigs[provider][field] = value;
    }
    
    save({
      ...localSettings,
      aiConfigs: newConfigs
    });
  };

  const handleToggleAutoApprove = () => {
    save({
      ...localSettings,
      aiConfigs: {
        ...localSettings.aiConfigs,
        autoApproveCommands: !localSettings.aiConfigs?.autoApproveCommands
      }
    });
  };

  // Appearance Handlers
  const loadThemes = async () => {
    // @ts-ignore
    const res = await window.api.getThemesList();
    if (res?.data) setThemes(res.data);
  };

  const loadEditingTheme = useCallback(async (id: string) => {
    // @ts-ignore
    const res = await window.api.getTheme(id);
    if (res?.data) setEditingTheme({ ...res.data, id });
  }, []);

  useEffect(() => {
    loadThemes();
    // @ts-ignore
    window.api.getSystemFonts().then((res: any) => { if (res?.data) setSystemFonts(res.data); });
  }, []);

  useEffect(() => { 
    if (localSettings.activeTheme) loadEditingTheme(localSettings.activeTheme); 
  }, [localSettings.activeTheme, loadEditingTheme]);

  const handleSelectTheme = (id: string) => { save({ ...localSettings, activeTheme: id }); };

  const persistTheme = useCallback((theme: any) => {
    // @ts-ignore
    window.api.saveTheme(theme.id, { name: theme.name, type: theme.type, isSystem: theme.isSystem, colors: theme.colors, fonts: theme.fonts });
    save({ ...localSettings, activeTheme: theme.id });
  }, [localSettings]);

  const handleColorPicker = (key: string, value: string) => {
    if (!editingTheme) return;
    const updated = { ...editingTheme, colors: { ...editingTheme.colors, [key]: value } };
    setEditingTheme(updated);
    persistTheme(updated);
  };

  const handleColorText = (key: string, value: string) => {
    if (!editingTheme) return;
    const updated = { ...editingTheme, colors: { ...editingTheme.colors, [key]: value } };
    setEditingTheme(updated);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistTheme(updated), 600);
  };

  const handleFontChange = (key: string, value: string) => {
    if (!editingTheme) return;
    const updated = { ...editingTheme, fonts: { ...(editingTheme.fonts || {}), [key]: value } };
    setEditingTheme(updated);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistTheme(updated), 600);
  };

  const handleFontSelect = (key: string, value: string) => {
    if (!editingTheme) return;
    const updated = { ...editingTheme, fonts: { ...(editingTheme.fonts || {}), [key]: value } };
    setEditingTheme(updated);
    persistTheme(updated);
  };

  const handleRestore = async () => {
    if (!editingTheme) return;
    // @ts-ignore
    await window.api.restoreDefaultTheme(editingTheme.id);
    await loadEditingTheme(editingTheme.id);
    save({ ...localSettings, activeTheme: editingTheme.id });
  };

  const handleDelete = async () => {
    if (!editingTheme || editingTheme.isSystem) return;
    // @ts-ignore
    await window.api.deleteTheme(editingTheme.id);
    await loadThemes();
    save({ ...localSettings, activeTheme: 'nord' });
  };

  const handleDuplicate = async () => {
    const name = duplicateName.trim();
    if (!name || !editingTheme) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newTheme = { name, type: editingTheme.type, isSystem: false, colors: { ...editingTheme.colors }, fonts: { ...(editingTheme.fonts || {}) } };
    // @ts-ignore
    await window.api.saveTheme(id, newTheme);
    await loadThemes();
    setShowDuplicateModal(false);
    setDuplicateName('');
    save({ ...localSettings, activeTheme: id });
  };

  // Centralized Key Manager Integration
  useEffect(() => {
    const api = {
      close: () => {
        if (onClose) onClose();
      },
      confirm: () => {
        if (showDuplicateModal) handleDuplicate();
      }
    };
    KeyManager.registerSettings(api);
    return () => KeyManager.unregisterSettings();
  }, [onClose, showDuplicateModal, duplicateName, handleDuplicate]);

  return (
    <div className="w-full h-full bg-background flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-48 border-r border-border bg-sidebar/50 p-4 space-y-2 shrink-0">
          <button onClick={() => setActiveTab('appearance')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'appearance' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Sun size={16} /> Appearance</button>
          <button onClick={() => setActiveTab('keybindings')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'keybindings' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Keyboard size={16} /> Keybindings</button>
          <button onClick={() => setActiveTab('ai')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'ai' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Bot size={16} /> AI Agent</button>
          <button onClick={() => setActiveTab('skills')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'skills' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><BrainCircuit size={16} /> Skills</button>
          <button onClick={() => setActiveTab('commands')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'commands' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Terminal size={16} /> Commands</button>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-xl font-bold capitalize">{activeTab}</h2>
             {activeTab === 'keybindings' && (
                <button onClick={() => {
                     const defaultKb: SettingsState['keybindings'] = {
                       global: { refresh: 'CTRL+R', quit: '' },
                       explorer: { toggleLeftPanel: 'CTRL+T' },
                       agent: { focusChat: 'CTRL+I', focusSkills: 'CTRL+/', focusCommands: 'CTRL+.', toggleRightPanel: 'CTRL+U' },
                       content: {
                         navigation: { switchTab: 'CTRL+TAB', closeTab: 'CTRL+W', focusContent: 'CTRL+Y' },
                         viewer: { enterEdit: 'A', moveDown: 'J', moveUp: 'K', moveLeft: 'H', moveRight: 'L', search: '/' },
                         generic: { exitEdit: 'ESCAPE', endOfLine: 'CTRL+E', startOfLine: 'CTRL+A', killLine: 'CTRL+K', selectAll: 'CTRL+Q', deleteForward: 'CTRL+D', cut: 'CTRL+X', copy: 'CTRL+C', paste: 'CTRL+V', prevLine: 'CTRL+P', nextLine: 'CTRL+N', forwardChar: 'CTRL+F', backwardChar: 'CTRL+B' }
                       }
                     };
                     save({ ...localSettings, keybindings: defaultKb });
                   }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors" title="Reset Keybindings to Defaults"><RotateCcw size={18} /></button>
             )}
          </div>

          {activeTab === 'appearance' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Theme</h3>
                  <div className="flex items-center gap-2">
                    {editingTheme && !editingTheme.isSystem && (
                      <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-md text-xs font-medium transition-colors"><Trash2 size={14} /> Delete</button>
                    )}
                    <button onClick={() => { setShowDuplicateModal(true); setDuplicateName((editingTheme?.name || 'My Theme') + ' Copy'); }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"><Copy size={14} /> Duplicate</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {themes.map(t => (
                    <button key={t.id} onClick={() => handleSelectTheme(t.id)} className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-w-[100px]", localSettings.activeTheme === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}>
                      <div className="w-20 h-14 rounded-md border flex items-center justify-center shadow-sm overflow-hidden" style={{ background: t.colors?.background, borderColor: t.colors?.border }}>
                        <div className="flex gap-1">
                          <div className="w-3 h-3 rounded-full" style={{ background: t.colors?.primary }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: t.colors?.accent }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: t.colors?.destructive }} />
                        </div>
                      </div>
                      <span className="text-xs font-medium">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <button onClick={() => setShowEditor(!showEditor)} className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"><Palette size={16} /> {showEditor ? 'Hide Theme Editor' : 'Customize Theme'}</button>
              </div>

              {showEditor && editingTheme?.colors && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {Object.entries(editingTheme.colors).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/20 group">
                        <label className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{COLOR_LABELS[key] || key}</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={val as string} onChange={(e) => handleColorPicker(key, e.target.value)} className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent" />
                          <input type="text" value={val as string} onChange={(e) => handleColorText(key, e.target.value)} onBlur={() => persistTheme(editingTheme)} className="w-20 bg-accent/20 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-primary" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4 pt-2 border-t border-border">
                    <h4 className="text-sm font-medium">Typography</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Font Family</label>
                        <div className="flex items-center gap-2">
                          <SearchableSelect value="" options={systemFonts} onChange={(v) => handleFontSelect('fontFamily', v + ', ui-sans-serif, system-ui, sans-serif')} placeholder="System fonts..." className="w-[140px]" />
                          <input type="text" value={editingTheme?.fonts?.fontFamily || ''} onChange={(e) => handleFontChange('fontFamily', e.target.value)} onBlur={() => persistTheme(editingTheme)} className="w-48 bg-accent/20 rounded border border-transparent px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Monospace Font</label>
                        <div className="flex items-center gap-2">
                          <SearchableSelect value="" options={systemFonts} onChange={(v) => handleFontSelect('fontMono', v + ', ui-monospace, SFMono-Regular, monospace')} placeholder="System fonts..." className="w-[140px]" />
                          <input type="text" value={editingTheme?.fonts?.fontMono || ''} onChange={(e) => handleFontChange('fontMono', e.target.value)} onBlur={() => persistTheme(editingTheme)} className="w-48 bg-accent/20 rounded border border-transparent px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Base Font Size</label>
                        <input type="text" value={editingTheme?.fonts?.fontSize || '14px'} onChange={(e) => handleFontChange('fontSize', e.target.value)} onBlur={() => persistTheme(editingTheme)} className="w-24 bg-accent/20 rounded border border-transparent px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary" />
                      </div>
                    </div>
                  </div>
                  {editingTheme.isSystem && (
                    <button onClick={handleRestore} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"><RotateCcw size={14} /> Restore Defaults</button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'keybindings' && (
             <div className="space-y-6 max-w-2xl">
                <p className="text-sm text-muted-foreground mb-6 text-xs">Customize shortcuts. Use 'Meta' for Cmd/Win. Global 'Close Tab' is priority.</p>
                <div className="space-y-6 pb-10">
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1">Global</div>
                      <KeyRow label="Refresh App" value={localSettings.keybindings.global.refresh} onChange={(v) => handleKeybindingChange('global', 'refresh', v)} />
                      <KeyRow label="Quit App" value={localSettings.keybindings.global.quit} onChange={(v) => handleKeybindingChange('global', 'quit', v)} />
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Explorer (Left Panel)</div>
                      <KeyRow label="Toggle Left Panel" value={localSettings.keybindings.explorer.toggleLeftPanel} onChange={(v) => handleKeybindingChange('explorer', 'toggleLeftPanel', v)} />
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">AI Agent (Right Panel)</div>
                      <KeyRow label="Focus Chat Input" value={localSettings.keybindings.agent.focusChat} onChange={(v) => handleKeybindingChange('agent', 'focusChat', v)} />
                      <KeyRow label="Focus & Skills" value={localSettings.keybindings.agent.focusSkills} onChange={(v) => handleKeybindingChange('agent', 'focusSkills', v)} />
                      <KeyRow label="Focus & Commands" value={localSettings.keybindings.agent.focusCommands} onChange={(v) => handleKeybindingChange('agent', 'focusCommands', v)} />
                      <KeyRow label="Toggle Right Panel" value={localSettings.keybindings.agent.toggleRightPanel} onChange={(v) => handleKeybindingChange('agent', 'toggleRightPanel', v)} />
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Content Navigation</div>
                      <KeyRow label="Switch Tab" value={localSettings.keybindings.content.navigation.switchTab} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'switchTab', v)} />
                      <KeyRow label="Close Active Tab" value={localSettings.keybindings.content.navigation.closeTab} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'closeTab', v)} />
                      <KeyRow label="Focus Active Tab" value={localSettings.keybindings.content.navigation.focusContent} onChange={(v) => handleKeybindingChangeNested('content', 'navigation', 'focusContent', v)} />
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Content Viewer (Read Only Mode)</div>
                      <KeyRow label="Enter Edit Mode" value={localSettings.keybindings.content.viewer.enterEdit} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'enterEdit', v)} />
                      <KeyRow label="Vim Move Down" value={localSettings.keybindings.content.viewer.moveDown} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveDown', v)} />
                      <KeyRow label="Vim Move Up" value={localSettings.keybindings.content.viewer.moveUp} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveUp', v)} />
                      <KeyRow label="Vim Move Left" value={localSettings.keybindings.content.viewer.moveLeft} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveLeft', v)} />
                      <KeyRow label="Vim Move Right" value={localSettings.keybindings.content.viewer.moveRight} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'moveRight', v)} />
                      <KeyRow label="Search Buffer" value={localSettings.keybindings.content.viewer.search} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'search', v)} />
                   </div>
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Content Generic (Read + Edit)</div>
                      <KeyRow label="Exit Edit (Esc)" value={localSettings.keybindings.content.generic.exitEdit} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'exitEdit', v)} />
                      <KeyRow label="Select All" value={localSettings.keybindings.content.generic.selectAll} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'selectAll', v)} />
                      <KeyRow label="Delete Character" value={localSettings.keybindings.content.generic.deleteForward} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'deleteForward', v)} />
                      <KeyRow label="Cut" value={localSettings.keybindings.content.generic.cut} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'cut', v)} />
                      <KeyRow label="Copy" value={localSettings.keybindings.content.generic.copy} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'copy', v)} />
                      <KeyRow label="Paste" value={localSettings.keybindings.content.generic.paste} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'paste', v)} />
                      <KeyRow label="Go to Start of Line" value={localSettings.keybindings.content.generic.startOfLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'startOfLine', v)} />
                      <KeyRow label="Go to End of Line" value={localSettings.keybindings.content.generic.endOfLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'endOfLine', v)} />
                      <KeyRow label="Kill to End of Line" value={localSettings.keybindings.content.generic.killLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'killLine', v)} />
                      <KeyRow label="Prev Line" value={localSettings.keybindings.content.generic.prevLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'prevLine', v)} />
                      <KeyRow label="Next Line" value={localSettings.keybindings.content.generic.nextLine} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'nextLine', v)} />
                      <KeyRow label="Forward Character" value={localSettings.keybindings.content.generic.forwardChar} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'forwardChar', v)} />
                      <KeyRow label="Backward Character" value={localSettings.keybindings.content.generic.backwardChar} onChange={(v) => handleKeybindingChangeNested('content', 'generic', 'backwardChar', v)} />
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium mb-2">AI Agent Configuration</h3>
                <p className="text-sm text-muted-foreground mb-6">Select and configure your preferred AI provider.</p>
                <div className="space-y-6">
                  {(['gemini', 'deepseek', 'ollama'] as const).map((provider) => (
                    <div key={provider} className="flex flex-col gap-2">
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input type="radio" name="ai-provider" value={provider} checked={localSettings.aiProvider === provider || (!localSettings.aiProvider && provider === 'gemini')} onChange={() => save({ ...localSettings, aiProvider: provider as any })} className="w-4 h-4 text-primary border-gray-300 focus:ring-primary" />
                        <span className="font-medium capitalize">{provider}</span>
                      </label>
                      {(localSettings.aiProvider === provider || (!localSettings.aiProvider && provider === 'gemini')) && (
                        <div className="ml-7 space-y-4 pt-2 pb-4">
                          {provider !== 'ollama' && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-medium text-muted-foreground">API Key</label>
                              <input type="password" placeholder={`Enter ${provider} API Key`} value={localSettings.aiConfigs?.[provider as 'gemini' | 'deepseek']?.apiKey || ''} onChange={(e) => handleAiConfigChange(provider, 'apiKey', e.target.value)} className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-primary transition-colors" />
                            </div>
                          )}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">URL Endpoint (Optional)</label>
                            <input type="text" placeholder={provider === 'ollama' ? "http://localhost:11434" : "Default URL"} value={localSettings.aiConfigs?.[provider]?.url || ''} onChange={(e) => handleAiConfigChange(provider, 'url', e.target.value)} className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-primary transition-colors" />
                          </div>
                          {provider === 'ollama' && (
                            <>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Model</label>
                                <input type="text" placeholder="gemma:e4b" value={localSettings.aiConfigs?.ollama?.model || 'gemma:e4b'} onChange={(e) => handleAiConfigChange(provider, 'model', e.target.value)} className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-primary transition-colors" />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Context Window</label>
                                <input type="number" placeholder="8192" value={localSettings.aiConfigs?.ollama?.contextWindow || 8192} onChange={(e) => handleAiConfigChange(provider, 'contextWindow', e.target.value)} className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-primary transition-colors" />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="pt-8 border-t border-border/50">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-accent/5">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Auto-Approve Commands</h4>
                      <p className="text-xs text-muted-foreground">Skip the approval prompt when the AI needs to run shell commands.</p>
                    </div>
                    <button onClick={handleToggleAutoApprove} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none", localSettings.aiConfigs?.autoApproveCommands ? "bg-primary" : "bg-muted")}>
                      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", localSettings.aiConfigs?.autoApproveCommands ? "translate-x-6" : "translate-x-1")} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-lg font-medium">Skill Folders</h3>
                   <button onClick={async () => {
                          // @ts-ignore
                          const res = await window.api.pickSkillFolder();
                          if (res && res.data) {
                            const newFolders = [...(localSettings.skills?.folders || []), res.data];
                            save({ ...localSettings, skills: { folders: Array.from(new Set(newFolders)) } });
                          }
                       }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-md text-xs font-medium transition-colors"><Plus size={14} /> Add Folder</button>
                </div>
                <div className="space-y-2">
                  {(localSettings.skills?.folders || []).map((folder, index) => (
                    <div key={folder} className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate">{folder.split(/[\/\\]/).pop()}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{folder}</span>
                      </div>
                      {index > 0 && (
                        <button onClick={() => {
                            const newFolders = (localSettings.skills?.folders || []).filter(f => f !== folder);
                            save({ ...localSettings, skills: { folders: newFolders } });
                          }} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-border">
                <button onClick={async () => {
                    // @ts-ignore
                    const res = await window.api.restoreDefaultSkills();
                    if (res && res.data) alert('Default skills restored successfully!');
                    else alert('Failed to restore default skills.');
                  }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"><RotateCcw size={14} /> Restore Default Skills</button>
              </div>
            </div>
          )}

          {activeTab === 'commands' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-lg font-medium">Command Folders</h3>
                   <button onClick={async () => {
                          // @ts-ignore
                          const res = await window.api.pickCommandFolder();
                          if (res && res.data) {
                            const newFolders = [...(localSettings.commands?.folders || []), res.data];
                            save({ ...localSettings, commands: { folders: Array.from(new Set(newFolders)) } });
                          }
                       }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-md text-xs font-medium transition-colors"><Plus size={14} /> Add Folder</button>
                </div>
                <div className="space-y-2">
                  {(localSettings.commands?.folders || []).map((folder, index) => (
                    <div key={folder} className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate">{folder.split(/[\/\\]/).pop()}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{folder}</span>
                      </div>
                      {index > 0 && (
                        <button onClick={() => {
                            const newFolders = (localSettings.commands?.folders || []).filter(f => f !== folder);
                            save({ ...localSettings, commands: { folders: newFolders } });
                          }} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-6 border-t border-border">
                <button onClick={async () => {
                    // @ts-ignore
                    const res = await window.api.restoreDefaultCommands();
                    if (res && res.data) alert('Default commands restored successfully!');
                    else alert('Failed to restore default commands.');
                  }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"><RotateCcw size={14} /> Restore Default Commands</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
            <h3 className="text-lg font-medium mb-4 text-foreground">Duplicate Theme</h3>
            <input autoFocus type="text" placeholder="Theme name" value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDuplicateModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
              <button onClick={handleDuplicate} className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors font-medium">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyRow({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 group">
      <div className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</div>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-40 bg-accent/20 rounded border border-transparent px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-primary text-right uppercase" />
    </div>
  );
}
