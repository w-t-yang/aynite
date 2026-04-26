import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Keyboard, Bot } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SettingsState {
  theme: 'dark' | 'light' | 'nord' | 'solarized';
  aiProvider?: 'gemini' | 'deepseek' | 'ollama';
  aiConfigs?: {
    [key in 'gemini' | 'deepseek' | 'ollama']?: {
      apiKey: string;
      url: string;
    };
  };
  keybindings: {
    commandTab: string;
    chatTab: string;
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
          ollama: { apiKey: '', url: 'http://localhost:11434' }
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

  const handleKeybindingChange = (type: 'commandTab' | 'chatTab', value: string) => {
    const keys = value.toUpperCase();
    save({
      ...localSettings,
      keybindings: {
        ...localSettings.keybindings,
        [type]: keys
      }
    });
  };

  const handleAiConfigChange = (provider: 'gemini' | 'deepseek' | 'ollama', field: 'apiKey' | 'url', value: string) => {
    const newConfigs = { ...localSettings.aiConfigs } as any;
    if (!newConfigs[provider]) {
      newConfigs[provider] = { apiKey: '', url: '' };
    }
    newConfigs[provider][field] = value;
    
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
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">API Key</label>
                            <input 
                              type="password"
                              placeholder={`Enter ${provider} API Key`}
                              value={localSettings.aiConfigs?.[provider]?.apiKey || ''}
                              onChange={(e) => handleAiConfigChange(provider, 'apiKey', e.target.value)}
                              className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted-foreground">URL Endpoint (Optional)</label>
                            <input 
                              type="text"
                              placeholder="Default URL"
                              value={localSettings.aiConfigs?.[provider]?.url || ''}
                              onChange={(e) => handleAiConfigChange(provider, 'url', e.target.value)}
                              className="w-full max-w-md bg-transparent border-b border-border/60 px-0 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                          </div>
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
                <p className="text-sm text-muted-foreground mb-6">
                  Customize the shortcuts used to navigate the app. Use 'Meta' for Cmd/Win key. Ex: Meta+X.
                </p>
                
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-3 border-b border-border/40">
                    <div>
                      <div className="font-medium text-sm">Toggle Console</div>
                    </div>
                    <input 
                      type="text" 
                      value={localSettings.keybindings.commandTab}
                      onChange={(e) => handleKeybindingChange('commandTab', e.target.value)}
                      className="w-32 bg-transparent border-b border-border/50 px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-500 text-right uppercase"
                    />
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
