import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Keyboard, Bot } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SettingsState {
  theme: 'dark' | 'light' | 'nord' | 'solarized';
  aiProvider?: 'gemini' | 'deepseek' | 'ollama';
  aiConfigs?: {
    gemini?: { apiKey: string; url: string };
    deepseek?: { apiKey: string; url: string };
    ollama?: { url: string; model: string; contextWindow: number };
  };
  keybindings: {
    commandTab: string;
    chatTab: string;
    closeTab: string;
    viewMode: {
      enterEdit: string;
      moveDown: string;
      moveUp: string;
      moveLeft: string;
      moveRight: string;
      search: string;
      prevLine: string;
      nextLine: string;
      forwardChar: string;
      backwardChar: string;
      startOfLine: string;
      endOfLine: string;
    };
    editMode: {
      exitEdit: string;
      endOfLine: string;
      startOfLine: string;
      killLine: string;
      copy: string;
      paste: string;
      selectAll: string;
      cut: string;
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
  const [activeTab, setActiveTab] = useState<'appearance' | 'keybindings' | 'ai'>('appearance');
  const [localSettings, setLocalSettings] = useState<SettingsState>(settings);

  useEffect(() => {
    // Ensure aiConfigs is initialized
    if (!settings.aiConfigs) {
      setLocalSettings(prev => ({
        ...prev,
        aiConfigs: {
          gemini: { apiKey: '', url: '' },
          deepseek: { apiKey: '', url: '' },
          ollama: { url: 'http://localhost:11434', model: 'deepseek-r1:14b', contextWindow: 8192 }
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

  const handleKeybindingChangeNested = (mode: 'viewMode' | 'editMode', type: string, value: string) => {
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
      newConfigs[provider] = provider === 'ollama' ? { url: 'http://localhost:11434', model: 'deepseek-r1:14b', contextWindow: 8192 } : { apiKey: '', url: '' };
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
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 overflow-y-auto">
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
                                  placeholder="deepseek-r1:14b"
                                  value={localSettings.aiConfigs?.ollama?.model || 'deepseek-r1:14b'}
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
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Theme</h3>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => save({ ...localSettings, theme: 'light' })}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      localSettings.theme === 'light' ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-gray-400 dark:hover:border-gray-600"
                    )}
                  >
                    <div className="w-24 h-16 bg-white border border-gray-200 rounded-md flex items-center justify-center text-black shadow-sm">
                      <Sun size={24} />
                    </div>
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  
                  <button 
                    onClick={() => save({ ...localSettings, theme: 'dark' })}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      localSettings.theme === 'dark' ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-gray-400 dark:hover:border-gray-600"
                    )}
                  >
                    <div className="w-24 h-16 bg-zinc-950 border border-zinc-800 rounded-md flex items-center justify-center text-white shadow-sm">
                      <Moon size={24} />
                    </div>
                    <span className="text-sm font-medium">Dark</span>
                  </button>

                  <button 
                    onClick={() => save({ ...localSettings, theme: 'nord' })}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      localSettings.theme === 'nord' ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-gray-400 dark:hover:border-gray-600"
                    )}
                  >
                    <div className="w-24 h-16 bg-[#2e3440] border border-[#4c566a] rounded-md flex items-center justify-center text-[#88c0d0] shadow-sm">
                      <Moon size={24} />
                    </div>
                    <span className="text-sm font-medium">Nord</span>
                  </button>

                  <button 
                    onClick={() => save({ ...localSettings, theme: 'solarized' })}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                      localSettings.theme === 'solarized' ? "border-blue-500 bg-blue-500/10" : "border-border hover:border-gray-400 dark:hover:border-gray-600"
                    )}
                  >
                    <div className="w-24 h-16 bg-[#002b36] border border-[#586e75] rounded-md flex items-center justify-center text-[#b58900] shadow-sm">
                      <Sun size={24} />
                    </div>
                    <span className="text-sm font-medium">Solarized</span>
                  </button>
                </div>
              </div>
            </div>
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
                      <KeyRow label="Command Palette" value={localSettings.keybindings.commandTab} onChange={(v) => handleKeybindingChange('commandTab', v)} />
                      <KeyRow label="Toggle Chat" value={localSettings.keybindings.chatTab} onChange={(v) => handleKeybindingChange('chatTab', v)} />
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
                      <KeyRow label="Prev Line" value={localSettings.keybindings.viewMode.prevLine} onChange={(v) => handleKeybindingChangeNested('viewMode', 'prevLine', v)} />
                      <KeyRow label="Next Line" value={localSettings.keybindings.viewMode.nextLine} onChange={(v) => handleKeybindingChangeNested('viewMode', 'nextLine', v)} />
                      <KeyRow label="Forward Character" value={localSettings.keybindings.viewMode.forwardChar} onChange={(v) => handleKeybindingChangeNested('viewMode', 'forwardChar', v)} />
                      <KeyRow label="Backward Character" value={localSettings.keybindings.viewMode.backwardChar} onChange={(v) => handleKeybindingChangeNested('viewMode', 'backwardChar', v)} />
                      <KeyRow label="Start of Line" value={localSettings.keybindings.viewMode.startOfLine} onChange={(v) => handleKeybindingChangeNested('viewMode', 'startOfLine', v)} />
                      <KeyRow label="End of Line" value={localSettings.keybindings.viewMode.endOfLine} onChange={(v) => handleKeybindingChangeNested('viewMode', 'endOfLine', v)} />
                   </div>

                   {/* Edit Mode */}
                   <div className="space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-2 px-1 border-t border-border/20 pt-4">Edit Mode</div>
                      <KeyRow label="Exit Edit (Esc)" value={localSettings.keybindings.editMode.exitEdit} onChange={(v) => handleKeybindingChangeNested('editMode', 'exitEdit', v)} />
                      <KeyRow label="Select All" value={localSettings.keybindings.editMode.selectAll} onChange={(v) => handleKeybindingChangeNested('editMode', 'selectAll', v)} />
                      <KeyRow label="Emacs Start of Line" value={localSettings.keybindings.editMode.startOfLine} onChange={(v) => handleKeybindingChangeNested('editMode', 'startOfLine', v)} />
                      <KeyRow label="Emacs End of Line" value={localSettings.keybindings.editMode.endOfLine} onChange={(v) => handleKeybindingChangeNested('editMode', 'endOfLine', v)} />
                      <KeyRow label="Kill to End of Line" value={localSettings.keybindings.editMode.killLine} onChange={(v) => handleKeybindingChangeNested('editMode', 'killLine', v)} />
                      <KeyRow label="Prev Line" value={localSettings.keybindings.editMode.prevLine} onChange={(v) => handleKeybindingChangeNested('editMode', 'prevLine', v)} />
                      <KeyRow label="Next Line" value={localSettings.keybindings.editMode.nextLine} onChange={(v) => handleKeybindingChangeNested('editMode', 'nextLine', v)} />
                      <KeyRow label="Forward Character" value={localSettings.keybindings.editMode.forwardChar} onChange={(v) => handleKeybindingChangeNested('editMode', 'forwardChar', v)} />
                      <KeyRow label="Backward Character" value={localSettings.keybindings.editMode.backwardChar} onChange={(v) => handleKeybindingChangeNested('editMode', 'backwardChar', v)} />
                   </div>
                </div>
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
