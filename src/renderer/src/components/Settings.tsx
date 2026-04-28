import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Moon, Sun, Keyboard, Bot, BrainCircuit, Plus, Trash2, RotateCcw, Terminal, Palette, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

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
    startChat: string;
    switchTab: string;
    closeTab: string;
    viewMode: {
      enterEdit: string;
      moveDown: string;
      moveUp: string;
      moveLeft: string;
      moveRight: string;
      search: string;
    };
    contentKeys: {
      exitEdit: string;
      endOfLine: string;
      startOfLine: string;
      killLine: string;
      selectAll: string;
      prevLine: string;
      nextLine: string;
      forwardChar: string;
      backwardChar: string;
    };
  };
}

interface SettingsProps {
  settings: SettingsState;
  onSave: (settings: SettingsState) => void;
  onClose: () => void;
}

export default function Settings({ settings, onSave }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'appearance' | 'keybindings' | 'ai' | 'skills' | 'commands'>('appearance');
  const [localSettings, setLocalSettings] = useState<SettingsState>(settings);

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

  const handleKeybindingChange = (type: string, value: string) => {
    const keys = value.toUpperCase();
    save({
      ...localSettings,
      keybindings: {
        ...localSettings.keybindings,
        [type]: keys
      }
    });
  };

  const handleKeybindingChangeNested = (mode: 'viewMode' | 'contentKeys', type: string, value: string) => {
    const keys = value.toUpperCase();
    save({
      ...localSettings,
      keybindings: {
        ...localSettings.keybindings,
        [mode]: {
          // @ts-ignore
          ...localSettings.keybindings[mode],
          [type]: keys
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

  return (
    <div className="w-full h-full bg-background flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-48 border-r border-border bg-sidebar/50 p-4 space-y-2 shrink-0">
          <button 
            onClick={() => setActiveTab('appearance')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
              activeTab === 'appearance' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun size={16} /> Appearance
          </button>
          <button 
            onClick={() => setActiveTab('keybindings')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
              activeTab === 'keybindings' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <Keyboard size={16} /> Keybindings
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
              activeTab === 'ai' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <Bot size={16} /> AI Agent
          </button>
          <button 
            onClick={() => setActiveTab('skills')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
              activeTab === 'skills' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <BrainCircuit size={16} /> Skills
          </button>
          <button 
            onClick={() => setActiveTab('commands')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-sm font-medium",
              activeTab === 'commands' ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <Terminal size={16} /> Commands
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'skills' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-lg font-medium">Skill Folders</h3>
                   <button 
                      onClick={async () => {
                         // @ts-ignore
                         const res = await window.api.pickSkillFolder();
                         if (res && res.data) {
                           const newFolders = [...(localSettings.skills?.folders || []), res.data];
                           save({ ...localSettings, skills: { folders: Array.from(new Set(newFolders)) } });
                         }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
                   >
                      <Plus size={14} /> Add Folder
                   </button>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Agent skills are loaded from these folders. Each skill should be a directory containing a SKILL.md file.
                </p>

                <div className="space-y-2">
                  {(localSettings.skills?.folders || []).map((folder, index) => (
                    <div key={folder} className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate">{folder.split(/[\/\\]/).pop()}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{folder}</span>
                      </div>
                      {index > 0 && (
                        <button 
                          onClick={() => {
                            const newFolders = (localSettings.skills?.folders || []).filter(f => f !== folder);
                            save({ ...localSettings, skills: { folders: newFolders } });
                          }}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-medium mb-2">Default Skills</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Restore bundled essential skills like skill-creator if they were deleted or modified.
                </p>
                <button 
                  onClick={async () => {
                    // @ts-ignore
                    const res = await window.api.restoreDefaultSkills();
                    if (res && res.data) {
                      alert('Default skills restored successfully!');
                    } else {
                      alert('Failed to restore default skills. Check if tmp/claude-skills exists.');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"
                >
                  <RotateCcw size={14} /> Restore Default Skills
                </button>
              </div>
            </div>
          )}

          {activeTab === 'commands' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-lg font-medium">Command Folders</h3>
                   <button 
                      onClick={async () => {
                         // @ts-ignore
                         const res = await window.api.pickCommandFolder();
                         if (res && res.data) {
                           const newFolders = [...(localSettings.commands?.folders || []), res.data];
                           save({ ...localSettings, commands: { folders: Array.from(new Set(newFolders)) } });
                         }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
                   >
                      <Plus size={14} /> Add Folder
                   </button>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Agent commands (executables or scripts) are loaded from these folders.
                </p>

                <div className="space-y-2">
                  {(localSettings.commands?.folders || []).map((folder, index) => (
                    <div key={folder} className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/10 group">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate">{folder.split(/[\/\\]/).pop()}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{folder}</span>
                      </div>
                      {index > 0 && (
                        <button 
                          onClick={() => {
                            const newFolders = (localSettings.commands?.folders || []).filter(f => f !== folder);
                            save({ ...localSettings, commands: { folders: newFolders } });
                          }}
                          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-medium mb-2">Default Commands</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Restore bundled essential commands like hello-world if they were deleted or modified.
                </p>
                <button 
                  onClick={async () => {
                    // @ts-ignore
                    const res = await window.api.restoreDefaultCommands();
                    if (res && res.data) {
                      alert('Default commands restored successfully!');
                    } else {
                      alert('Failed to restore default commands.');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"
                >
                  <RotateCcw size={14} /> Restore Default Commands
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium mb-2">AI Agent Configuration</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Select and configure your preferred AI provider. More options may be added in the future.
                </p>
                
                <div className="space-y-6">
                  {(['gemini', 'deepseek', 'ollama'] as const).map((provider) => (
                    <div key={provider} className="flex flex-col gap-2">
                      <label className="flex items-center gap-3 cursor-pointer py-1">
                        <input 
                          type="radio" 
                          name="ai-provider" 
                          value={provider}
                          checked={localSettings.aiProvider === provider || (!localSettings.aiProvider && provider === 'gemini')}
                          onChange={() => save({ ...localSettings, aiProvider: provider as any })}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" 
                        />
                        <span className="font-medium capitalize">{provider}</span>
                      </label>
                      
                      {(localSettings.aiProvider === provider || (!localSettings.aiProvider && provider === 'gemini')) && (
                        <div className="ml-7 space-y-4 pt-2 pb-4">
                          {provider !== 'ollama' && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-medium text-muted-foreground">API Key</label>
                              <input 
                                type="password"
                                placeholder={`Enter ${provider} API Key`}
                                value={localSettings.aiConfigs?.[provider as 'gemini' | 'deepseek']?.apiKey || ''}
                                onChange={(e) => handleAiConfigChange(provider, 'apiKey', e.target.value)}
                                className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                              />
                            </div>
                          )}
                          
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">URL Endpoint (Optional)</label>
                            <input 
                              type="text"
                              placeholder={provider === 'ollama' ? "http://localhost:11434" : "Default URL"}
                              value={localSettings.aiConfigs?.[provider]?.url || ''}
                              onChange={(e) => handleAiConfigChange(provider, 'url', e.target.value)}
                              className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                          </div>

                          {provider === 'ollama' && (
                            <>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Model</label>
                                <input 
                                  type="text"
                                  placeholder="gemma:e4b"
                                  value={localSettings.aiConfigs?.ollama?.model || 'gemma:e4b'}
                                  onChange={(e) => handleAiConfigChange(provider, 'model', e.target.value)}
                                  className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Context Window</label>
                                <input 
                                  type="number"
                                  placeholder="8192"
                                  value={localSettings.aiConfigs?.ollama?.contextWindow || 8192}
                                  onChange={(e) => handleAiConfigChange(provider, 'contextWindow', e.target.value)}
                                  className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                />
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
                    <button 
                      onClick={handleToggleAutoApprove}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        localSettings.aiConfigs?.autoApproveCommands ? "bg-blue-600" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        localSettings.aiConfigs?.autoApproveCommands ? "translate-x-6" : "translate-x-1"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <AppearanceTab settings={localSettings} onSave={save} />
          )}

          {activeTab === 'keybindings' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-medium mb-2">Keyboard Shortcuts</h3>
                <p className="text-sm text-muted-foreground mb-6 text-xs">
                  Customize shortcuts. Use 'Meta' for Cmd/Win. Global 'Close Tab' is priority.
                </p>
                
                <div className="space-y-6 pb-10">
                   {/* Global */}
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1">Global</div>
                      <KeyRow label="Start Chat" value={localSettings.keybindings.startChat} onChange={(v) => handleKeybindingChange('startChat', v)} />
                      <KeyRow label="Switch Tab" value={localSettings.keybindings.switchTab} onChange={(v) => handleKeybindingChange('switchTab', v)} />
                      <KeyRow label="Close Active Tab" value={localSettings.keybindings.closeTab} onChange={(v) => handleKeybindingChange('closeTab', v)} />
                   </div>

                   {/* View Mode */}
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">View Mode</div>
                      <KeyRow label="Enter Edit Mode" value={localSettings.keybindings.viewMode.enterEdit} onChange={(v) => handleKeybindingChangeNested('viewMode', 'enterEdit', v)} />
                      <KeyRow label="Vim Move Down" value={localSettings.keybindings.viewMode.moveDown} onChange={(v) => handleKeybindingChangeNested('viewMode', 'moveDown', v)} />
                      <KeyRow label="Vim Move Up" value={localSettings.keybindings.viewMode.moveUp} onChange={(v) => handleKeybindingChangeNested('viewMode', 'moveUp', v)} />
                      <KeyRow label="Vim Move Left" value={localSettings.keybindings.viewMode.moveLeft} onChange={(v) => handleKeybindingChangeNested('viewMode', 'moveLeft', v)} />
                      <KeyRow label="Vim Move Right" value={localSettings.keybindings.viewMode.moveRight} onChange={(v) => handleKeybindingChangeNested('viewMode', 'moveRight', v)} />
                      <KeyRow label="Search Buffer" value={localSettings.keybindings.viewMode.search} onChange={(v) => handleKeybindingChangeNested('viewMode', 'search', v)} />
                   </div>

                   {/* Content Keys */}
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Content Keys (View + Edit)</div>
                      <KeyRow label="Exit Edit (Esc)" value={localSettings.keybindings.contentKeys.exitEdit} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'exitEdit', v)} />
                      <KeyRow label="Select All" value={localSettings.keybindings.contentKeys.selectAll} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'selectAll', v)} />
                      <KeyRow label="Emacs Start of Line" value={localSettings.keybindings.contentKeys.startOfLine} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'startOfLine', v)} />
                      <KeyRow label="Emacs End of Line" value={localSettings.keybindings.contentKeys.endOfLine} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'endOfLine', v)} />
                      <KeyRow label="Kill to End of Line" value={localSettings.keybindings.contentKeys.killLine} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'killLine', v)} />
                      <KeyRow label="Prev Line" value={localSettings.keybindings.contentKeys.prevLine} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'prevLine', v)} />
                      <KeyRow label="Next Line" value={localSettings.keybindings.contentKeys.nextLine} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'nextLine', v)} />
                      <KeyRow label="Forward Character" value={localSettings.keybindings.contentKeys.forwardChar} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'forwardChar', v)} />
                      <KeyRow label="Backward Character" value={localSettings.keybindings.contentKeys.backwardChar} onChange={(v) => handleKeybindingChangeNested('contentKeys', 'backwardChar', v)} />
                   </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <h3 className="text-sm font-medium mb-2">Reset Keybindings</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Restore all keyboard shortcuts to their default values. This will overwrite your current keybindings.
                </p>
                <button 
                  onClick={() => {
                    const defaultKb: SettingsState['keybindings'] = {
                      startChat: 'CTRL+T',
                      switchTab: 'CTRL+TAB',
                      closeTab: 'CTRL+W',
                      viewMode: {
                        enterEdit: 'A',
                        moveDown: 'J',
                        moveUp: 'K',
                        moveLeft: 'H',
                        moveRight: 'L',
                        search: '/',
                      },
                      contentKeys: {
                        exitEdit: 'ESCAPE',
                        endOfLine: 'CTRL+E',
                        startOfLine: 'CTRL+A',
                        killLine: 'CTRL+K',
                        selectAll: 'CTRL+Q',
                        prevLine: 'CTRL+P',
                        nextLine: 'CTRL+N',
                        forwardChar: 'CTRL+F',
                        backwardChar: 'CTRL+B'
                      }
                    };
                    save({ ...localSettings, keybindings: defaultKb });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors"
                >
                  <RotateCcw size={14} /> Reset to Defaults
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function KeyRow({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 group">
      <div className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</div>
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40 bg-accent/20 rounded border border-transparent px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-blue-500 text-right uppercase"
      />
    </div>
  );
}

// Color label mapping for display
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

function AppearanceTab({ settings, onSave }: { settings: SettingsState, onSave: (s: SettingsState) => void }) {
  const [themes, setThemes] = useState<any[]>([]);
  const [editingTheme, setEditingTheme] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const saveTimerRef = useRef<any>(null);

  const loadThemes = async () => {
    // @ts-ignore
    const res = await window.api.getThemesList();
    if (res?.data) setThemes(res.data);
  };

  const loadEditingTheme = async (id: string) => {
    // @ts-ignore
    const res = await window.api.getTheme(id);
    if (res?.data) setEditingTheme({ ...res.data, id });
  };

  useEffect(() => {
    loadThemes();
    // @ts-ignore
    window.api.getSystemFonts().then((res: any) => { if (res?.data) setSystemFonts(res.data); });
  }, []);
  useEffect(() => { if (settings.activeTheme) loadEditingTheme(settings.activeTheme); }, [settings.activeTheme]);

  const handleSelectTheme = (id: string) => { onSave({ ...settings, activeTheme: id }); };

  const persistTheme = useCallback((theme: any) => {
    // @ts-ignore
    window.api.saveTheme(theme.id, { name: theme.name, type: theme.type, isSystem: theme.isSystem, colors: theme.colors, fonts: theme.fonts });
    onSave({ ...settings, activeTheme: theme.id });
  }, [settings, onSave]);

  // Color picker (native) fires onChange on final pick, so save immediately
  const handleColorPicker = (key: string, value: string) => {
    if (!editingTheme) return;
    const updated = { ...editingTheme, colors: { ...editingTheme.colors, [key]: value } };
    setEditingTheme(updated);
    persistTheme(updated);
  };

  // Text inputs: update local state immediately, debounce save
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
    onSave({ ...settings, activeTheme: editingTheme.id });
  };

  const handleDelete = async () => {
    if (!editingTheme || editingTheme.isSystem) return;
    // @ts-ignore
    await window.api.deleteTheme(editingTheme.id);
    await loadThemes();
    onSave({ ...settings, activeTheme: 'nord' });
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
    onSave({ ...settings, activeTheme: id });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Theme</h3>
          <div className="flex items-center gap-2">
            {editingTheme && !editingTheme.isSystem && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-md text-xs font-medium transition-colors">
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button onClick={() => { setShowDuplicateModal(true); setDuplicateName((editingTheme?.name || 'My Theme') + ' Copy'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors">
              <Copy size={14} /> Duplicate
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {themes.map(t => (
            <button key={t.id} onClick={() => handleSelectTheme(t.id)}
              className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-w-[100px]",
                settings.activeTheme === t.id ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-blue-500/40")}>
              <div className="w-20 h-14 rounded-md border flex items-center justify-center shadow-sm overflow-hidden"
                style={{ background: t.colors?.background, borderColor: t.colors?.border }}>
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
        <button onClick={() => setShowEditor(!showEditor)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <Palette size={16} />
          {showEditor ? 'Hide Theme Editor' : 'Customize Theme'}
        </button>
      </div>

      {showEditor && editingTheme?.colors && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(editingTheme.colors).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/20 group">
                <label className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{COLOR_LABELS[key] || key}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={val as string} onChange={(e) => handleColorPicker(key, e.target.value)}
                    className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent" />
                  <input type="text" value={val as string} onChange={(e) => handleColorText(key, e.target.value)}
                    onBlur={() => persistTheme(editingTheme)}
                    className="w-20 bg-accent/20 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            ))}
          </div>
          {editingTheme.isSystem && (
            <button onClick={handleRestore} className="flex items-center gap-1.5 px-3 py-1.5 border border-border hover:bg-accent rounded-md text-xs font-medium transition-colors">
              <RotateCcw size={14} /> Restore Defaults
            </button>
          )}
        </div>
      )}

      {showEditor && (
        <div className="space-y-4 pt-2 border-t border-border">
          <h4 className="text-sm font-medium">Typography</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Font Family</label>
              <div className="flex items-center gap-2">
                <select value="" onChange={(e) => { if (e.target.value) handleFontSelect('fontFamily', e.target.value + ', ui-sans-serif, system-ui, sans-serif'); }}
                  className="bg-accent/20 rounded border border-transparent px-2 py-1 text-xs focus:outline-none focus:border-blue-500 max-w-[140px]">
                  <option value="">System fonts…</option>
                  {systemFonts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input type="text" value={editingTheme?.fonts?.fontFamily || ''} onChange={(e) => handleFontChange('fontFamily', e.target.value)}
                  onBlur={() => persistTheme(editingTheme)}
                  className="w-48 bg-accent/20 rounded border border-transparent px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Monospace Font</label>
              <div className="flex items-center gap-2">
                <select value="" onChange={(e) => { if (e.target.value) handleFontSelect('fontMono', e.target.value + ', ui-monospace, SFMono-Regular, monospace'); }}
                  className="bg-accent/20 rounded border border-transparent px-2 py-1 text-xs focus:outline-none focus:border-blue-500 max-w-[140px]">
                  <option value="">System fonts…</option>
                  {systemFonts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input type="text" value={editingTheme?.fonts?.fontMono || ''} onChange={(e) => handleFontChange('fontMono', e.target.value)}
                  onBlur={() => persistTheme(editingTheme)}
                  className="w-48 bg-accent/20 rounded border border-transparent px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Base Font Size</label>
              <input type="text" value={editingTheme?.fonts?.fontSize || '14px'} onChange={(e) => handleFontChange('fontSize', e.target.value)}
                onBlur={() => persistTheme(editingTheme)}
                className="w-24 bg-accent/20 rounded border border-transparent px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
            <h3 className="text-lg font-medium mb-4 text-foreground">Duplicate Theme</h3>
            <input autoFocus type="text" placeholder="Theme name" value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleDuplicate()}
              className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDuplicateModal(false)} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
              <button onClick={handleDuplicate} className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors font-medium">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
