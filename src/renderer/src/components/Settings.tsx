import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Moon, Sun, Keyboard, Bot, BrainCircuit, Plus, Trash2, RotateCcw, Terminal, Palette, Copy, ChevronDown, Search, FileText, Wrench, Zap, Info, CloudDownload, RefreshCw, Github, Bug, AlertCircle } from 'lucide-react';
import { DEFAULT_KEYBINDINGS } from '../../../main/default_configs/keybindings';
import { DEFAULT_AI_CONFIG, DEFAULT_PROVIDER_MODELS, DEFAULT_PROVIDER_URLS, DEFAULT_AI_TOOLS } from '../../../main/default_configs/ai';
import { cn } from '../lib/utils';
import { SearchableSelect } from './ui/SearchableSelect';
import { KeyManager } from '../lib/key-handlers';
import { AIProviderInstance, SettingsState } from '../lib/types';
import { UnifiedCollapsible } from './Chat';




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
  const [activeTab, setActiveTab] = useState<'appearance' | 'keybindings' | 'ai' | 'skills' | 'commands' | 'agents' | 'tools' | 'about'>(() => {
    return (localStorage.getItem('aynite_settings_active_tab') as any) || 'appearance';
  });

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    localStorage.setItem('aynite_settings_active_tab', tab);
  };

  const [localSettings, setLocalSettings] = useState<SettingsState>(settings);

  // Appearance State
  const [themes, setThemes] = useState<any[]>([]);
  const [editingTheme, setEditingTheme] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [mergedPrompt, setMergedPrompt] = useState('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [availableCommands, setAvailableCommands] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const saveTimerRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    window.api.getAppVersion().then(v => setAppVersion(v));

    if (!window.api) return;

    const unsubChecking = window.api.onUpdateChecking(() => setUpdateStatus('checking'));
    const unsubAvailable = (info: any) => {
      setUpdateStatus('available');
      setUpdateInfo(info);
    };
    const offAvailable = window.api.onUpdateAvailable(unsubAvailable);

    const unsubNotAvailable = window.api.onUpdateNotAvailable(() => setUpdateStatus('idle'));
    const unsubError = window.api.onUpdateError(() => {
      setUpdateStatus('error');
    });
    const unsubProgress = () => {
      setUpdateStatus('downloading');
    };
    const offProgress = window.api.onUpdateProgress(unsubProgress);

    const unsubDownloaded = (info: any) => {
      setUpdateStatus('downloaded');
      setUpdateInfo(info);
    };
    const offDownloaded = window.api.onUpdateDownloaded(unsubDownloaded);

    return () => {
      unsubChecking?.();
      offAvailable?.();
      unsubNotAvailable?.();
      unsubError?.();
      offProgress?.();
      offDownloaded?.();
    };
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (activeTab === 'agents') {
      const activeAgent = localSettings.agents?.list?.find(a => a.id === localSettings.agents?.activeId);
      // @ts-ignore
      window.api.getMergedSystemPrompt(localSettings.prompts?.files, activeAgent?.promptFiles).then(res => {
        if (res?.data) setMergedPrompt(res.data);
      });
    }
    if (activeTab === 'skills') {
      // @ts-ignore
      window.api.getAvailableSkills().then(res => {
        if (res?.data) setAvailableSkills(res.data);
      });
    }
    if (activeTab === 'commands') {
      // @ts-ignore
      window.api.getAvailableCommands().then(res => {
        if (res?.data) setAvailableCommands(res.data);
      });
    }
    if (activeTab === 'tools') {
      // @ts-ignore
      window.api.getTools().then(res => {
        if (res?.data) setAvailableTools(res.data);
      });
    }
  }, [activeTab, localSettings.prompts?.files, localSettings.agents]);

  const handleAddAgent = () => {
    const id = `agent-${Date.now()}`;
    const newAgent = { id, name: 'New Agent', promptFiles: [] };
    const newList = [...(localSettings.agents?.list || []), newAgent];
    save({
      ...localSettings,
      agents: {
        activeId: localSettings.agents?.activeId || id,
        list: newList
      }
    });
  };

  const handleDeleteAgent = (id: string) => {
    const newList = (localSettings.agents?.list || []).filter(a => a.id !== id);
    let newActiveId = localSettings.agents?.activeId;
    if (newActiveId === id) {
      newActiveId = newList.length > 0 ? newList[0].id : '';
    }
    save({
      ...localSettings,
      agents: {
        activeId: newActiveId || '',
        list: newList
      }
    });
  };

  const handleUpdateAgent = (id: string, field: string, value: any) => {
    const newList = (localSettings.agents?.list || []).map(a => {
      if (a.id === id) return { ...a, [field]: value };
      return a;
    });
    save({
      ...localSettings,
      agents: {
        ...localSettings.agents,
        list: newList
      }
    });
  };

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

  const handleAddProvider = () => {
    const id = `provider-${Date.now()}`;
    const newProvider: AIProviderInstance = {
      id,
      name: 'Ollama - gemma4:e4b',
      provider: 'ollama',
      url: 'http://localhost:11434',
      model: 'gemma4:e4b',
      contextWindow: 8192
    };
    const newProviders = [...(localSettings.ai?.providers || []), newProvider];
    save({
      ...localSettings,
      ai: {
        activeId: localSettings.ai?.activeId || id,
        providers: newProviders
      }
    });
  };

  const handleDeleteProvider = (id: string) => {
    const newProviders = (localSettings.ai?.providers || []).filter(p => p.id !== id);
    let newActiveId = localSettings.ai?.activeId;
    if (newActiveId === id) {
      newActiveId = newProviders.length > 0 ? newProviders[0].id : '';
    }
    save({
      ...localSettings,
      ai: {
        activeId: newActiveId || '',
        providers: newProviders
      }
    });
  };

  const handleUpdateProvider = (id: string, field: string, value: any) => {
    const newProviders = (localSettings.ai?.providers || []).map(p => {
      if (p.id === id) {
        const updated = {
          ...p,
          [field]: field === 'contextWindow' ? (parseInt(value, 10) || 8192) : value
        };

        // Auto-update name if provider or model changes
        if (field === 'provider' || field === 'model') {
          // If provider changed, also update the model and URL to its default
          if (field === 'provider') {
            updated.model = DEFAULT_PROVIDER_MODELS[value] || updated.model;
            updated.url = DEFAULT_PROVIDER_URLS[value] !== undefined ? DEFAULT_PROVIDER_URLS[value] : updated.url;
          }

          const providerLabel = {
            ollama: 'Ollama',
            openai: 'OpenAI',
            anthropic: 'Anthropic',
            gemini: 'Gemini',
            deepseek: 'DeepSeek',
            others: 'Compatible'
          }[updated.provider] || updated.provider;

          updated.name = `${providerLabel} - ${updated.model || 'Default'}`;
        }

        return updated;
      }
      return p;
    });
    save({
      ...localSettings,
      ai: {
        ...localSettings.ai,
        providers: newProviders
      }
    });
  };

  const handleSetActiveProvider = (id: string) => {
    save({
      ...localSettings,
      ai: {
        ...localSettings.ai,
        activeId: id
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
        <div className="w-52 border-r border-border bg-sidebar/50 p-4 space-y-1 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2 px-3">Basic</div>
          <button onClick={() => handleTabChange('appearance')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'appearance' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Sun size={16} /> Appearance</button>
          <button onClick={() => handleTabChange('keybindings')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'keybindings' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Keyboard size={16} /> Keybindings</button>

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">AI</div>
          <button onClick={() => handleTabChange('ai')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'ai' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Bot size={16} /> Providers</button>
          <button onClick={() => handleTabChange('agents')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'agents' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><FileText size={16} /> Agents</button>
          <button onClick={() => handleTabChange('tools')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'tools' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Wrench size={16} /> Tools</button>
          <button onClick={() => handleTabChange('skills')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'skills' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Zap size={16} /> Skills</button>
          <button onClick={() => handleTabChange('commands')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'commands' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Terminal size={16} /> Commands</button>

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">App</div>
          <button onClick={() => handleTabChange('about')} className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium", activeTab === 'about' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground")}><Info size={16} /> About</button>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 overflow-y-auto overflow-x-auto">
          <div className="max-w-5xl mx-auto w-full min-w-[640px]">
            {activeTab !== 'about' && (
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold capitalize">{activeTab === 'ai' ? 'Providers' : activeTab === 'agents' ? 'Agents' : activeTab === 'tools' ? 'Tools' : activeTab}</h2>
                {activeTab === 'keybindings' && (
                  <button onClick={() => {
                    save({ ...localSettings, keybindings: DEFAULT_KEYBINDINGS });
                  }} className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors" title="Reset Keybindings to Defaults"><RotateCcw size={18} /></button>
                )}
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6 max-w-4xl">
                <p className="text-sm text-muted-foreground mb-6">Customize themes, fonts, and the visual aesthetic of your workspace.</p>
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
              <div className="space-y-6 max-w-4xl">
                <p className="text-sm text-muted-foreground mb-6">Configure keyboard shortcuts for navigation, editing, and assistant actions.</p>
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
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Aynite Assistant (Right Panel)</div>
                    <KeyRow label="Focus Chat Input" value={localSettings.keybindings.agent.focusChat} onChange={(v) => handleKeybindingChange('agent', 'focusChat', v)} />
                    <KeyRow label="Focus & Skills" value={localSettings.keybindings.agent.focusSkills} onChange={(v) => handleKeybindingChange('agent', 'focusSkills', v)} />
                    <KeyRow label="Focus & Commands" value={localSettings.keybindings.agent.focusCommands} onChange={(v) => handleKeybindingChange('agent', 'focusCommands', v)} />
                    <KeyRow label="Chat Submit" value={localSettings.keybindings.agent.submit} onChange={(v) => handleKeybindingChange('agent', 'submit', v)} />
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
                    <KeyRow label="Refresh Tab / Revert" value={localSettings.keybindings.content.viewer.refresh} onChange={(v) => handleKeybindingChangeNested('content', 'viewer', 'refresh', v)} />
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
              <div className="space-y-6 max-w-4xl">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-muted-foreground">Manage multiple AI provider configurations and select the active one.</p>
                    <button
                      onClick={handleAddProvider}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 text-primary-foreground rounded-md text-xs font-medium transition-colors"
                    >
                      <Plus size={14} /> Add Provider
                    </button>
                  </div>

                  <div className="space-y-6">
                    {(localSettings.ai?.providers || []).map((provider) => (
                      <div key={provider.id} className={cn(
                        "p-5 rounded-xl border transition-all space-y-4",
                        localSettings.ai?.activeId === provider.id ? "border-primary bg-accent/5 ring-0" : "border-border bg-accent/5"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="active-ai-provider"
                              checked={localSettings.ai?.activeId === provider.id}
                              onChange={() => handleSetActiveProvider(provider.id)}
                              className="w-4 h-4 text-primary border-gray-300 focus:ring-primary cursor-pointer"
                            />
                            <input
                              type="text"
                              value={provider.name}
                              onChange={(e) => handleUpdateProvider(provider.id, 'name', e.target.value)}
                              className="font-bold bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-sm w-64"
                              placeholder="Config Name"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteProvider(provider.id)}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                            title="Delete Configuration"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 ml-7">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Type</label>
                            <select
                              value={provider.provider}
                              onChange={(e) => handleUpdateProvider(provider.id, 'provider', e.target.value)}
                              className="w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                            >
                              <option value="ollama" className="bg-background text-foreground">Ollama</option>
                              <option value="openai" className="bg-background text-foreground">OpenAI</option>
                              <option value="anthropic" className="bg-background text-foreground">Anthropic</option>
                              <option value="gemini" className="bg-background text-foreground">Gemini/Google</option>
                              <option value="deepseek" className="bg-background text-foreground">DeepSeek</option>
                              <option value="others" className="bg-background text-foreground">Other (Compatible)</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Model</label>
                            <input
                              type="text"
                              value={provider.model}
                              onChange={(e) => handleUpdateProvider(provider.id, 'model', e.target.value)}
                              placeholder="e.g. gpt-4o or deepseek-r1"
                              className="w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors"
                            />
                          </div>

                          {provider.provider !== 'ollama' && (
                            <div className="flex flex-col gap-1.5 col-span-2">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">API Key</label>
                              <input
                                type="password"
                                value={provider.apiKey || ''}
                                onChange={(e) => handleUpdateProvider(provider.id, 'apiKey', e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors"
                              />
                            </div>
                          )}

                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Base URL</label>
                            <input
                              type="text"
                              value={provider.url || ''}
                              onChange={(e) => handleUpdateProvider(provider.id, 'url', e.target.value)}
                              placeholder={provider.provider === 'ollama' ? "http://localhost:11434" : "API URL"}
                              className="w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors"
                            />
                          </div>

                          {provider.provider === 'others' && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Compatibility</label>
                              <select
                                value={provider.compatibility || 'openai'}
                                onChange={(e) => handleUpdateProvider(provider.id, 'compatibility', e.target.value)}
                                className="w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                              >
                                <option value="openai" className="bg-background text-foreground">OpenAI</option>
                                <option value="anthropic" className="bg-background text-foreground">Anthropic</option>
                                <option value="google" className="bg-background text-foreground">Google</option>
                              </select>
                            </div>
                          )}

                          {provider.provider === 'ollama' && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Context Window</label>
                              <input
                                type="number"
                                value={provider.contextWindow || 8192}
                                onChange={(e) => handleUpdateProvider(provider.id, 'contextWindow', e.target.value)}
                                className="w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {(!localSettings.ai?.providers || localSettings.ai.providers.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border rounded-xl opacity-50">
                        <Bot size={48} className="mb-4 text-muted-foreground" />
                        <p className="text-sm">No AI providers configured. Add one to get started.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}


            {activeTab === 'agents' && (
              <div className="space-y-10 max-w-4xl pb-10">
                <div className="flex items-center justify-between border-b border-border/30 pb-4">
                  <p className="text-sm text-muted-foreground">Manage global prompts and specialized agents.</p>
                  <button onClick={async () => {
                    // @ts-ignore
                    const res = await window.api.restoreDefaultPrompts();
                    if (res && res.data) {
                      save({
                        ...localSettings,
                        prompts: res.data.prompts,
                        agents: res.data.agents
                      });
                      (window as any).showToast('Agents and Prompts restored successfully!', 'success');
                    }
                  }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors" title="Restore Agents and Prompts to Defaults"><RotateCcw size={14} /> Restore Defaults</button>
                </div>
                {/* Global System Prompts */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Global System Prompts</h3>
                    <div className="flex items-center gap-2">
                      <button onClick={async () => {
                        // @ts-ignore
                        const res = await window.api.pickPromptFile();
                        if (res && res.data) {
                          const newFiles = [...(localSettings.prompts?.files || []), res.data];
                          save({ ...localSettings, prompts: { files: Array.from(new Set(newFiles)) } });
                        }
                      }} className="flex items-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium transition-colors"><Plus size={14} /> Add File</button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">These prompts are applied to all agents.</p>
                  <div className="space-y-2">
                    {(localSettings.prompts?.files || []).map((filePath) => (
                      <div key={filePath} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-accent/5 group">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium truncate">{filePath.split(/[\/\\]/).pop()}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{filePath}</span>
                        </div>
                        <button onClick={() => {
                          const newFiles = (localSettings.prompts?.files || []).filter(f => f !== filePath);
                          save({ ...localSettings, prompts: { files: newFiles } });
                        }} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Agents List */}
                <div className="pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium">Agents</h3>
                    <button onClick={handleAddAgent} className="flex items-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium transition-colors"><Plus size={14} /> Add Agent</button>
                  </div>

                  <div className="space-y-6">
                    {(localSettings.agents?.list || []).map((agent) => (
                      <div key={agent.id} className={cn(
                        "p-5 rounded-xl border transition-all space-y-4",
                        localSettings.agents?.activeId === agent.id ? "border-primary bg-accent/5" : "border-border bg-accent/5"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="active-agent"
                              checked={localSettings.agents?.activeId === agent.id}
                              onChange={() => save({ ...localSettings, agents: { ...localSettings.agents, activeId: agent.id } })}
                              className="w-4 h-4 text-primary border-gray-300 focus:ring-primary cursor-pointer"
                            />
                            <input
                              type="text"
                              value={agent.name}
                              onChange={(e) => handleUpdateAgent(agent.id, 'name', e.target.value)}
                              className="font-bold bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-sm w-64"
                              placeholder="Agent Name"
                            />
                          </div>
                          <button onClick={() => handleDeleteAgent(agent.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"><Trash2 size={16} /></button>
                        </div>

                        <div className="ml-7 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Agent Prompt Files</h4>
                            <button onClick={async () => {
                              // @ts-ignore
                              const res = await window.api.pickPromptFile();
                              if (res && res.data) {
                                const newFiles = [...(agent.promptFiles || []), res.data];
                                handleUpdateAgent(agent.id, 'promptFiles', Array.from(new Set(newFiles)));
                              }
                            }} className="text-[10px] font-bold text-primary hover:underline transition-all flex items-center gap-1"><Plus size={10} /> Add File</button>
                          </div>

                          <div className="space-y-2">
                            {(agent.promptFiles || []).map((filePath) => (
                              <div key={filePath} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-background/40 group/file">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-medium truncate">{filePath.split(/[\/\\]/).pop()}</span>
                                  <span className="text-[9px] text-muted-foreground truncate">{filePath}</span>
                                </div>
                                <button onClick={() => {
                                  const newFiles = (agent.promptFiles || []).filter(f => f !== filePath);
                                  handleUpdateAgent(agent.id, 'promptFiles', newFiles);
                                }} className="p-1 text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover/file:opacity-100"><X size={12} /></button>
                              </div>
                            ))}
                            {(agent.promptFiles || []).length === 0 && <div className="text-[10px] text-muted-foreground italic opacity-50 py-2">No agent-specific prompt files.</div>}
                          </div>

                          <div className="pt-2">
                            <UnifiedCollapsible title="System Prompt Preview" icon={FileText} colorClass="border-primary/20" defaultExpanded={false}>
                              <div className="p-4 rounded-lg bg-background/50 border border-border/40 font-mono text-[10px] whitespace-pre-wrap max-h-60 overflow-y-auto">
                                {localSettings.agents?.activeId === agent.id ? mergedPrompt : <span className="text-muted-foreground italic">Switch to this agent to see the preview.</span>}
                              </div>
                            </UnifiedCollapsible>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'skills' && (
              <div className="space-y-6 max-w-4xl">
                <p className="text-sm text-muted-foreground mb-6">Manage advanced skill directories and automated agent workflows.</p>
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
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <button onClick={async () => {
                              // @ts-ignore
                              const res = await window.api.restoreDefaultSkills();
                              if (res && res.data) (window as any).showToast('Default skills restored successfully!', 'success');
                              else (window as any).showToast('Failed to restore default skills.', 'error');
                            }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-[10px] font-medium transition-colors"><RotateCcw size={12} /> Restore Defaults</button>
                          )}
                          {index > 0 && (
                            <button onClick={() => {
                              const newFolders = (localSettings.skills?.folders || []).filter(f => f !== folder);
                              save({ ...localSettings, skills: { folders: newFolders } });
                            }} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4">Detected Skills</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableSkills.map(skill => (
                      <div key={skill.path} className={cn("p-3 rounded-lg border bg-accent/5", skill.error ? "border-destructive/30" : "border-border")}>
                        <div className="flex items-center gap-2 mb-1">
                          {skill.error && <AlertCircle size={14} className="text-destructive" />}
                          <span className={cn("text-xs font-semibold", skill.error && "text-destructive")}>{skill.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">{skill.description || 'No description'}</p>
                        {skill.error && (
                          <div className="p-2 rounded bg-destructive/10 text-[9px] text-destructive font-mono leading-tight whitespace-pre-wrap">
                            {skill.error}
                          </div>
                        )}
                        {!skill.error && <div className="text-[9px] text-muted-foreground/50 truncate font-mono">{skill.path}</div>}
                      </div>
                    ))}
                    {availableSkills.length === 0 && <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg">No skills detected in the configured folders.</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'commands' && (
              <div className="space-y-6 max-w-4xl">
                <p className="text-sm text-muted-foreground mb-6">Configure custom shell command directories for assistant execution.</p>
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
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <button onClick={async () => {
                              // @ts-ignore
                              const res = await window.api.restoreDefaultCommands();
                              if (res && res.data) (window as any).showToast('Default commands restored successfully!', 'success');
                              else (window as any).showToast('Failed to restore default commands.', 'error');
                            }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-[10px] font-medium transition-colors"><RotateCcw size={12} /> Restore Defaults</button>
                          )}
                          {index > 0 && (
                            <button onClick={() => {
                              const newFolders = (localSettings.commands?.folders || []).filter(f => f !== folder);
                              save({ ...localSettings, commands: { folders: newFolders } });
                            }} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-medium mb-4">Detected Commands</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableCommands.map(cmd => (
                      <div key={cmd.path} className={cn("p-3 rounded-lg border bg-accent/5", cmd.error ? "border-destructive/30" : "border-border")}>
                        <div className="flex items-center gap-2 mb-1">
                          {cmd.error && <AlertCircle size={14} className="text-destructive" />}
                          <span className={cn("text-xs font-semibold", cmd.error && "text-destructive")}>{cmd.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">{cmd.description || 'No description'}</p>
                        {cmd.error && (
                          <div className="p-2 rounded bg-destructive/10 text-[9px] text-destructive font-mono leading-tight whitespace-pre-wrap">
                            {cmd.error}
                          </div>
                        )}
                        {!cmd.error && <div className="text-[9px] text-muted-foreground/50 truncate font-mono">{cmd.path}</div>}
                      </div>
                    ))}
                    {availableCommands.length === 0 && <div className="col-span-full py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border rounded-lg">No commands detected in the configured folders.</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tools" && (
              <div className="space-y-6 max-w-4xl pb-10">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm text-muted-foreground">Enable or disable individual capabilities available to the Aynite Assistant.</p>
                    <button
                      onClick={() => {
                        save({
                          ...localSettings,
                          aiTools: { ...DEFAULT_AI_TOOLS }
                        });
                        (window as any).showToast('Tool configurations restored to defaults.', 'success');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"
                      title="Restore Tools to Defaults"
                    >
                      <RotateCcw size={14} /> Restore Defaults
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {availableTools.map(tool => (
                      <div key={tool.id} className="flex items-center justify-between p-3.5 rounded-lg border border-border/40 bg-accent/5 hover:bg-accent/10 transition-colors group">
                        <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                          <h4 className="text-sm font-semibold truncate">{tool.name}</h4>
                          <p className="text-[11px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity leading-relaxed">{tool.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            const current = localSettings.aiTools || {};
                            save({
                              ...localSettings,
                              aiTools: {
                                ...current,
                                [tool.id]: current[tool.id] === false ? true : false
                              }
                            });
                          }}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all focus:outline-none",
                            localSettings.aiTools?.[tool.id] !== false ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.3)]" : "bg-muted"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200",
                            localSettings.aiTools?.[tool.id] !== false ? "translate-x-5" : "translate-x-1"
                          )} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <div className="space-y-10 max-w-4xl pb-10">
                <div className="flex flex-col items-center text-center space-y-4 pt-4">
                  <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20">
                    <Bot size={48} className="text-primary-foreground" />
                  </div>
                  <div className="space-y-1.5 text-center">
                    <h3 className="text-3xl font-black tracking-tight text-foreground">Aynite</h3>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-semibold text-primary tracking-widest uppercase">A.Y.N.I.T.E</p>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">All You Need Is The Editor</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-accent/30 rounded-full border border-border/50 text-[11px] font-mono text-muted-foreground">
                    Version {appVersion || '0.0.0'}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 pt-4">
                  <div className="p-6 rounded-2xl border border-border bg-accent/5 flex items-center justify-between group">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <CloudDownload size={16} className="text-primary" />
                        Software Update
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {updateStatus === 'idle' && 'Your software is up to date.'}
                        {updateStatus === 'checking' && 'Checking for updates...'}
                        {updateStatus === 'available' && `New version available: v${updateInfo?.version}`}
                        {updateStatus === 'downloading' && 'Downloading update in background...'}
                        {updateStatus === 'downloaded' && `Version v${updateInfo?.version} is ready to install.`}
                        {updateStatus === 'error' && 'Failed to check for updates.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(updateStatus === 'idle' || updateStatus === 'error') && (
                        <button
                          onClick={() => window.api.checkUpdates()}
                          className="px-4 py-1.5 bg-accent hover:bg-accent/80 rounded-lg text-xs font-medium transition-all"
                        >
                          Check for Updates
                        </button>
                      )}
                      {updateStatus === 'checking' && (
                        <button disabled className="px-4 py-1.5 bg-accent/50 rounded-lg text-xs font-medium flex items-center gap-2">
                          <RefreshCw size={12} className="animate-spin" /> Checking
                        </button>
                      )}
                      {updateStatus === 'available' && (
                        <button disabled className="px-4 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-medium">
                          Downloading...
                        </button>
                      )}
                      {updateStatus === 'downloaded' && (
                        <button
                          onClick={() => window.api.installUpdate()}
                          className="px-4 py-1.5 bg-primary text-primary-foreground hover:brightness-110 rounded-lg text-xs font-medium shadow-lg shadow-primary/20 transition-all"
                        >
                          Update and Restart
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border border-border bg-accent/5 space-y-4">
                    <h4 className="text-sm font-semibold">Resources</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => window.api.openExternal('https://github.com/w-t-yang/aynite')} className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                        <Github size={14} /> GitHub Project
                      </button>
                      <button onClick={() => window.api.openExternal('https://github.com/w-t-yang/aynite/issues')} className="flex items-center gap-2 p-2 hover:bg-accent rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border">
                        <Bug size={14} /> Report an Issue
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-10 text-center">
                  <p className="text-[10px] text-muted-foreground/50 font-mono italic">
                    Built with ❤️ for the AI lifestyle
                  </p>
                </div>
              </div>
            )}
          </div>
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
