import React, { useState, useEffect } from 'react';
import {
  Sun, Keyboard, Bot, FileText, Wrench, Zap, Terminal, Info, X, RotateCcw
} from 'lucide-react';
import { SettingsState } from '../../shared/lib/types';
import { cn } from '../../shared/lib/utils';

// Shared Tabs
import { AppearanceTab } from '../../shared/pages/settings/AppearanceTab';
import { KeybindingsTab } from '../../shared/pages/settings/KeybindingsTab';
import { AITab } from '../../shared/pages/settings/AITab';
import { AgentsTab } from '../../shared/pages/settings/AgentsTab';
import { SkillsTab } from '../../shared/pages/settings/SkillsTab';
import { CommandsTab } from '../../shared/pages/settings/CommandsTab';
import { ToolsTab } from '../../shared/pages/settings/ToolsTab';
import { AboutTab } from '../../shared/pages/settings/AboutTab';
import { TabButton } from '../../shared/basic/TabButton';
import { Modal } from '../../shared/basic/Modal';
import { Button } from '../../shared/basic/Button';
import { useAynite } from '../../shared/context/MockViewContext';


interface SettingsProps {
}

export function Settings({ }: SettingsProps) {
  const aynite = useAynite();
  const [activeTab, setActiveTab] = useState('appearance');

  // Broken down settings state
  const [themes, setThemes] = useState<{ list: any[], activeId: string, systemFonts: string[] } | null>(null);
  const [ai, setAI] = useState<SettingsState['ai'] | null>(null);
  const [agents, setAgents] = useState<SettingsState['agents'] | null>(null);
  const [prompts, setPrompts] = useState<SettingsState['prompts'] | null>(null);
  const [keybindings, setKeybindings] = useState<SettingsState['keybindings'] | null>(null);
  const [skills, setSkills] = useState<any | null>(null);
  const [commands, setCommands] = useState<any | null>(null);
  const [aiTools, setAiTools] = useState<SettingsState['aiTools'] | null>(null);

  // Other shared state
  const [appVersion, setAppVersion] = useState<string>('');
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  useEffect(() => {
    loadSettings();
    loadVersion();
  }, []);

  const loadSettings = async () => {
    // Parallel load all decoupled resources
    const [resAI, resAgents, resPrompts, resKb, resSkills, resCmds, resTools, resThemes] = await Promise.all([
      aynite.getAI(),
      aynite.getAgents(),
      aynite.getPrompts(),
      aynite.getKeybindings(),
      aynite.getSkills(),
      aynite.getCommands(),
      aynite.getTools(),
      aynite.getThemes()
    ]);

    if (resAI) setAI({ activeId: resAI.activeId, providers: resAI.list });
    if (resAgents) setAgents({ activeId: resAgents.activeId, list: resAgents.list });
    if (resPrompts) setPrompts({ files: resPrompts.list });
    if (resKb) setKeybindings(resKb.list);
    if (resSkills) setSkills(resSkills);
    if (resCmds) setCommands(resCmds);
    if (resTools) {
      setAiTools(resTools.active);
      setAvailableTools(resTools.list);
    }
    if (resThemes) setThemes(resThemes);
  };

  const loadVersion = async () => {
    const version = await aynite.getAppVersion();
    setAppVersion(version);
  };


  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // ─── Tab Set Handlers ──────────────────────────────────────────────

  const handleSetThemes = async (newThemes: { list: any[], activeId: string }) => {
    setThemes(prev => prev ? { ...newThemes, systemFonts: prev.systemFonts } : null);
    await aynite.setThemes(newThemes);
    if (newThemes.list.length === 0) {
      await loadSettings();
    }
  };

  const handleSetKeybindings = async (kb: SettingsState['keybindings']) => {
    setKeybindings(kb);
    await aynite.setKeybindings({ list: kb });
  };

  const handleSetAI = async (newAI: SettingsState['ai']) => {
    setAI(newAI);
    await aynite.setAI({ activeId: newAI.activeId, list: newAI.providers });
  };

  const handleSetSkills = async (newSkills: any) => {
    setSkills(newSkills);
    await aynite.setSkills(newSkills);
  };

  const handleSetCommands = async (newCommands: any) => {
    setCommands(newCommands);
    await aynite.setCommands(newCommands);
  };

  const handleSetTools = async (newTools: SettingsState['aiTools']) => {
    setAiTools(newTools);
    await aynite.setTools({ active: newTools, list: availableTools });
  };

  if (!ai || !agents || !prompts || !keybindings || !aiTools) {
    return <div className="w-full h-full bg-background flex items-center justify-center text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="w-full h-full bg-background flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-52 border-r border-border bg-sidebar/50 p-4 space-y-1 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2 px-3">Basic</div>
          <TabButton active={activeTab === 'appearance'} onClick={() => handleTabChange('appearance')} icon={<Sun size={16} />} label="Appearance" />
          <TabButton active={activeTab === 'keybindings'} onClick={() => handleTabChange('keybindings')} icon={<Keyboard size={16} />} label="Keybindings" />

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">AI</div>
          <TabButton active={activeTab === 'ai'} onClick={() => handleTabChange('ai')} icon={<Bot size={16} />} label="Providers" />
          <TabButton active={activeTab === 'agents'} onClick={() => handleTabChange('agents')} icon={<FileText size={16} />} label="Agents" />
          <TabButton active={activeTab === 'tools'} onClick={() => handleTabChange('tools')} icon={<Wrench size={16} />} label="Tools" />
          <TabButton active={activeTab === 'skills'} onClick={() => handleTabChange('skills')} icon={<Zap size={16} />} label="Skills" />
          <TabButton active={activeTab === 'commands'} onClick={() => handleTabChange('commands')} icon={<Terminal size={16} />} label="Commands" />

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">App</div>
          <TabButton active={activeTab === 'about'} onClick={() => handleTabChange('about')} icon={<Info size={16} />} label="About" />
        </div>

        {/* Settings Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar relative">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-semibold capitalize tracking-tight">
                  {activeTab === 'ai' ? 'Providers' : activeTab === 'agents' ? 'Agents' : activeTab === 'tools' ? 'Tools' : activeTab}
                </h2>
                {activeTab !== 'about' && (
                  <button
                    onClick={() => setShowRestoreModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-all border border-transparent hover:border-border"
                  >
                    <RotateCcw size={14} />
                    Restore Defaults
                  </button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'appearance' && "Customize the look and feel of your workspace with themes and fonts."}
                {activeTab === 'keybindings' && "Configure keyboard shortcuts for quick actions and navigation."}
                {activeTab === 'ai' && "Manage AI service providers and models for the assistant."}
                {activeTab === 'agents' && "Define specialized assistant personas with custom prompts."}
                {activeTab === 'tools' && "Enable or disable built-in tools for the AI to interact with your system."}
                {activeTab === 'skills' && "Extend the assistant's capabilities with custom scripts."}
                {activeTab === 'commands' && "Manage custom shell commands and automation tasks."}
                {activeTab === 'about' && "Information about Aynite and system updates."}
              </p>
            </div>

            {activeTab === 'appearance' && themes && (
              <AppearanceTab
                state={{ list: themes.list, activeId: themes.activeId, systemFonts: themes.systemFonts }}
                actions={{ setThemes: handleSetThemes }}
              />
            )}

            {activeTab === 'keybindings' && (
              <KeybindingsTab
                state={{ keybindings }}
                actions={{ setKeybindings: handleSetKeybindings }}
              />
            )}

            {activeTab === 'ai' && (
              <AITab
                state={{ ai }}
                actions={{ setAI: handleSetAI }}
              />
            )}

            {activeTab === 'agents' && (
              <AgentsTab
                state={{ agents, prompts, mergedPrompt: '' }}
                actions={{
                  setAgentsTab: async (payload) => {
                    if (payload.agents) {
                      setAgents(payload.agents);
                      await aynite.setAgents({ activeId: payload.agents.activeId, list: payload.agents.list });
                    }
                    if (payload.prompts) {
                      setPrompts(payload.prompts);
                      await aynite.setPrompts({ list: payload.prompts.files });
                    }
                  },
                  onPickPromptFile: async () => null // Removed
                }}
              />
            )}

            {activeTab === 'skills' && (
              <SkillsTab
                state={{
                  skills: { folders: skills?.list || [] },
                  availableSkills: skills?.items || []
                }}
                actions={{
                  setSkills: (newSkills) => {
                    if (newSkills) {
                      handleSetSkills({ list: newSkills.folders, items: skills?.items || [] });
                    }
                  },
                  onPickSkillFolder: async () => null // Removed
                }}
              />
            )}

            {activeTab === 'commands' && (
              <CommandsTab
                state={{
                  commands: { folders: commands?.list || [] },
                  availableCommands: commands?.items || []
                }}
                actions={{
                  setCommands: (newCmds) => {
                    if (newCmds) {
                      handleSetCommands({ list: newCmds.folders, items: commands?.items || [] });
                    }
                  },
                  onPickCommandFolder: async () => null // Removed
                }}
              />
            )}

            {activeTab === 'tools' && (
              <ToolsTab
                state={{ aiTools, availableTools }}
                actions={{ setTools: handleSetTools }}
              />
            )}

            {activeTab === 'about' && (
              <AboutTab
                state={{
                  appVersion,
                  updateStatus: 'idle',
                  updateInfo: null
                }}
                actions={{
                  onCheckUpdates: aynite.checkForUpdates,
                  onInstallUpdate: () => { },
                  onOpenExternal: (url) => window.open(url, '_blank')
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Global Restore Confirmation */}
      <Modal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        title={`Restore ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} to Defaults`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRestoreModal(false)}>Cancel</Button>
            <Button 
              variant="primary" 
              onClick={async () => {
                // Execute standardized restore logic
                if (activeTab === 'appearance') await handleSetThemes({ list: [], activeId: '' });
                if (activeTab === 'keybindings') {
                  const res = await aynite.getKeybindings();
                  if (res && res.list) handleSetKeybindings(res.list);
                }
                if (activeTab === 'ai') {
                  const res = await aynite.getAI();
                  if (res) handleSetAI({ activeId: res.activeId, providers: res.list });
                }
                if (activeTab === 'agents') {
                  const res = await aynite.getAgents();
                  if (res) {
                    setAgents({ activeId: res.activeId, list: res.list });
                    await aynite.setAgents({ activeId: res.activeId, list: res.list });
                  }
                }
                if (activeTab === 'skills') {
                  const res = await aynite.getSkills();
                  if (res) handleSetSkills(res);
                }
                if (activeTab === 'commands') {
                  const res = await aynite.getCommands();
                  if (res) handleSetCommands(res);
                }
                if (activeTab === 'tools') {
                  const res = await aynite.getTools();
                  if (res) handleSetTools(res.active);
                }
                setShowRestoreModal(false);
              }}
            >
              Confirm Restore
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">Are you sure you want to restore <span className="font-bold capitalize">{activeTab}</span> settings to their default values?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">This will overwrite all your current configurations for this tab. This action cannot be undone.</p>
        </div>
      </Modal>
    </div>
  );
}

