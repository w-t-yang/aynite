import {
  Bot,
  FileText,
  Info,
  Keyboard,
  Sun,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_AI_CONFIG, DEFAULT_AI_TOOLS } from '../../../lib/constants/ai'
import { DEFAULT_KEYBINDINGS } from '../../../lib/constants/keybindings'
import type { Theme } from '../../../lib/constants/types'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { TabButton } from '../../shared/basic/TabButton'
import type { SettingsState } from '../../shared/lib/types'
import { useView } from '../ViewContext'
import { AboutTab } from './AboutTab'
import { AgentsTab } from './AgentsTab'
import { AITab } from './AITab'
// Shared Tabs
import { AppearanceTab } from './AppearanceTab'
import { CommandsTab } from './CommandsTab'
import { KeybindingsTab } from './KeybindingsTab'
import { SkillsTab } from './SkillsTab'
import { ToolsTab } from './ToolsTab'

export function Settings() {
  const [activeTab, setActiveTab] = useState('appearance')

  // Broken down settings state
  const {
    themes: contextThemes,
    activeThemeId,
    setTheme: setContextTheme,
  } = useView()
  const [ai, setAI] = useState<SettingsState['ai'] | null>(null)
  const [agents, setAgents] = useState<SettingsState['agents'] | null>(null)
  const [prompts, setPrompts] = useState<SettingsState['prompts'] | null>(null)
  const [keybindings, setKeybindings] = useState<
    SettingsState['keybindings'] | null
  >(null)
  const [skills, setSkills] = useState<{
    folders: string[]
    items: any[]
  } | null>(null)
  const [commands, setCommands] = useState<{
    folders: string[]
    items: any[]
  } | null>(null)
  const [themes, setThemes] = useState<{
    list: Theme[]
    activeId: string
    systemFonts: string[]
  } | null>(null)
  const [aiTools, setAiTools] = useState<SettingsState['aiTools'] | null>(null)
  const [mergedPrompt, setMergedPrompt] = useState<string>('')

  // Other shared state
  const [appVersion, setAppVersion] = useState<string>('')
  const [availableTools, setAvailableTools] = useState<
    { id: string; name: string; description: string }[]
  >([])
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  const loadSettings = useCallback(async () => {
    // Parallel load all decoupled resources
    const [
      resAI,
      resAgents,
      resPrompts,
      resKb,
      resSkillsCfg,
      resSkillsItems,
      resCmdsCfg,
      resCmdsItems,
      resTools,
    ] = await Promise.all([
      window.aynite.getConfig('ai'),
      window.aynite.getConfig('agents'),
      window.aynite.getConfig('prompts'),
      window.aynite.getConfig('keybindings'),
      window.aynite.getConfig('skills'),
      window.aynite.getAvailableSkills(),
      window.aynite.getConfig('commands'),
      window.aynite.getAvailableCommands(),
      window.aynite.getConfig('tools'),
    ])

    if (resAI) setAI({ activeId: resAI.activeId, providers: resAI.providers })
    const normalizedGlobalPrompts = resPrompts?.files || resPrompts?.list || []
    if (resAgents) {
      setAgents({ activeId: resAgents.activeId, list: resAgents.list })

      // Load merged prompt for active agent
      const merged = await window.aynite.getMergedSystemPrompt(
        normalizedGlobalPrompts,
        resAgents.list.find((a: any) => a.id === resAgents.activeId)
          ?.promptFiles || [],
      )
      setMergedPrompt(merged || '')
    }
    if (resPrompts) setPrompts({ files: normalizedGlobalPrompts })
    if (resKb) setKeybindings(resKb)

    setSkills({
      folders: resSkillsCfg?.folders || [],
      items: resSkillsItems || [],
    })
    setCommands({
      folders: resCmdsCfg?.folders || [],
      items: resCmdsItems || [],
    })

    if (resTools) {
      setAiTools(resTools.active)
      setAvailableTools(resTools.list)
    }

    // Initialize themes state
    const systemFonts = await window.aynite.getSystemFonts()
    setThemes({
      list: contextThemes,
      activeId: activeThemeId,
      systemFonts,
    })
  }, [contextThemes, activeThemeId])

  const loadVersion = useCallback(async () => {
    const version = await window.aynite.getConfig('version')
    setAppVersion(version)
  }, [])

  useEffect(() => {
    loadSettings()
    loadVersion()
  }, [loadVersion, loadSettings])

  // Reload settings when theme changes externally (e.g. from title bar)
  // useAppEvent(AppEvents.THEME_CHANGED, loadSettings)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  // ─── Tab Set Handlers ──────────────────────────────────────────────

  const handleSetThemes = async (newThemes: {
    list: Theme[]
    activeId: string
  }) => {
    setThemes((prev) =>
      prev ? { ...newThemes, systemFonts: prev.systemFonts } : null,
    )
    // Save the active theme ID specifically
    if (newThemes.activeId) {
      await setContextTheme(newThemes.activeId)
    }
    // Individual theme saving is handled via setThemes logic if needed,
    // but usually themes are static unless customized.
    if (newThemes.list.length === 0) {
      await loadSettings()
    }
  }

  const handleSetKeybindings = async (kb: SettingsState['keybindings']) => {
    setKeybindings(kb)
    await window.aynite.setConfig('keybindings', { list: kb })
  }

  const handleSetAI = async (newAI: SettingsState['ai']) => {
    setAI(newAI)
    await window.aynite.setConfig('ai', {
      activeId: newAI.activeId,
      providers: newAI.providers,
    })
  }

  const handleSetSkills = async (newSkills: any) => {
    setSkills(newSkills)
    await window.aynite.setConfig('skills', newSkills)
  }

  const handleSetCommands = async (newCommands: any) => {
    setCommands(newCommands)
    await window.aynite.setConfig('commands', newCommands)
  }

  const handleSetTools = async (newTools: SettingsState['aiTools']) => {
    setAiTools(newTools)
    await window.aynite.setConfig('tools', {
      active: newTools,
      list: availableTools,
    })
  }

  const handlePickSkillFolder = async () => {
    const folder = await window.aynite.pickSkillFolder()
    if (folder) {
      const newFolders = Array.from(
        new Set([...(skills?.folders || []), folder]),
      )
      await handleSetSkills({ folders: newFolders })
      await loadSettings()
    }
  }

  const handlePickCommandFolder = async () => {
    const folder = await window.aynite.pickCommandFolder()
    if (folder) {
      const newFolders = Array.from(
        new Set([...(commands?.folders || []), folder]),
      )
      await handleSetCommands({ folders: newFolders })
      await loadSettings()
    }
  }

  const handlePickPromptFile = async () => {
    const file = await window.aynite.selectFile({
      title: 'Select Prompt File',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    return file ? { data: file } : null
  }

  if (
    !ai ||
    !agents ||
    !prompts ||
    !keybindings ||
    !aiTools ||
    !skills ||
    !commands
  ) {
    return (
      <div className="w-full h-full bg-background flex items-center justify-center text-muted-foreground">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-card flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-52 border-r border-border bg-sidebar/50 p-4 space-y-1 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2 px-3">
            Basic
          </div>
          <TabButton
            active={activeTab === 'appearance'}
            onClick={() => handleTabChange('appearance')}
            icon={<Sun size={16} />}
            label="Appearance"
          />
          <TabButton
            active={activeTab === 'keybindings'}
            onClick={() => handleTabChange('keybindings')}
            icon={<Keyboard size={16} />}
            label="Keybindings"
          />

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            AI
          </div>
          <TabButton
            active={activeTab === 'ai'}
            onClick={() => handleTabChange('ai')}
            icon={<Bot size={16} />}
            label="Providers"
          />
          <TabButton
            active={activeTab === 'agents'}
            onClick={() => handleTabChange('agents')}
            icon={<FileText size={16} />}
            label="Agents"
          />
          <TabButton
            active={activeTab === 'tools'}
            onClick={() => handleTabChange('tools')}
            icon={<Wrench size={16} />}
            label="Tools"
          />
          <TabButton
            active={activeTab === 'skills'}
            onClick={() => handleTabChange('skills')}
            icon={<Zap size={16} />}
            label="Skills"
          />
          <TabButton
            active={activeTab === 'commands'}
            onClick={() => handleTabChange('commands')}
            icon={<Terminal size={16} />}
            label="Commands"
          />

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            App
          </div>
          <TabButton
            active={activeTab === 'about'}
            onClick={() => handleTabChange('about')}
            icon={<Info size={16} />}
            label="About"
          />
        </div>

        {/* Settings Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col custom-scrollbar relative">
            {activeTab === 'appearance' && (
              <AppearanceTab
                state={{
                  list: themes?.list || contextThemes,
                  activeId: themes?.activeId || activeThemeId,
                  systemFonts: themes?.systemFonts || [],
                }}
                actions={{
                  setThemes: handleSetThemes,
                  onRestore: () => setShowRestoreModal(true),
                }}
              />
            )}

            {activeTab === 'keybindings' && (
              <KeybindingsTab
                state={{ keybindings }}
                actions={{
                  setKeybindings: handleSetKeybindings,
                  onRestore: () => setShowRestoreModal(true),
                }}
              />
            )}

            {activeTab === 'ai' && (
              <AITab
                state={{ ai }}
                actions={{
                  setAI: handleSetAI,
                  onRestore: () => setShowRestoreModal(true),
                }}
              />
            )}

            {activeTab === 'agents' && (
              <AgentsTab
                state={{ agents, prompts, mergedPrompt }}
                actions={{
                  setAgentsTab: async (payload) => {
                    if (payload.agents) {
                      setAgents(payload.agents)
                      await window.aynite.setConfig('agents', {
                        activeId: payload.agents.activeId,
                        list: payload.agents.list,
                      })
                    }
                    if (payload.prompts) {
                      setPrompts(payload.prompts)
                      await window.aynite.setConfig('prompts', {
                        files: payload.prompts.files,
                      })
                    }
                    await loadSettings()
                  },
                  onPickPromptFile: handlePickPromptFile,
                  onRestore: () => setShowRestoreModal(true),
                }}
              />
            )}

            {activeTab === 'skills' && (
              <SkillsTab
                state={{
                  skills: { folders: skills?.folders || [] },
                  availableSkills: skills?.items || [],
                }}
                actions={{
                  setSkills: (newSkills) => {
                    if (newSkills) {
                      handleSetSkills(newSkills)
                    }
                  },
                  onPickSkillFolder: handlePickSkillFolder,
                  onRestore: () => setShowRestoreModal(true),
                }}
              />
            )}

            {activeTab === 'commands' && (
              <CommandsTab
                state={{
                  commands: { folders: commands?.folders || [] },
                  availableCommands: commands?.items || [],
                }}
                actions={{
                  setCommands: (newCmds) => {
                    if (newCmds) {
                      handleSetCommands(newCmds)
                    }
                  },
                  onPickCommandFolder: handlePickCommandFolder,
                  onRestore: () => setShowRestoreModal(true),
                }}
              />
            )}

            {activeTab === 'tools' && (
              <ToolsTab
                state={{ aiTools, availableTools }}
                actions={{
                  setTools: handleSetTools,
                  onRestore: () => setShowRestoreModal(true),
                }}
              />
            )}

            {activeTab === 'about' && (
              <AboutTab
                state={{
                  appVersion,
                  updateStatus: 'idle',
                  updateInfo: null,
                }}
                actions={{
                  onCheckUpdates: window.aynite.checkForUpdates,
                  onInstallUpdate: () => {},
                  onOpenExternal: (url) => window.open(url, '_blank'),
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
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRestoreModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                // Execute standardized restore logic
                if (activeTab === 'appearance') {
                  await setContextTheme('light')
                  await loadSettings()
                }
                if (activeTab === 'keybindings') {
                  await window.aynite.setConfig('keybindings', {
                    list: DEFAULT_KEYBINDINGS,
                  })
                  await loadSettings()
                }

                if (activeTab === 'ai') {
                  await window.aynite.setConfig('ai', {
                    activeId: DEFAULT_AI_CONFIG.activeId,
                    list: DEFAULT_AI_CONFIG.providers,
                  })
                  await loadSettings()
                }
                if (activeTab === 'agents') {
                  await window.aynite.restorePrompts()
                  await loadSettings()
                }
                if (activeTab === 'skills') {
                  await window.aynite.restoreSkills()
                  await loadSettings()
                }
                if (activeTab === 'commands') {
                  await window.aynite.restoreCommands()
                  await loadSettings()
                }
                if (activeTab === 'tools') {
                  await window.aynite.setConfig('tools', {
                    active: DEFAULT_AI_TOOLS,
                    list: availableTools,
                  })
                  await loadSettings()
                }
                setShowRestoreModal(false)
              }}
            >
              Confirm Restore
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            Are you sure you want to restore{' '}
            <span className="font-bold capitalize">{activeTab}</span> settings
            to their default values?
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This will overwrite all your current configurations for this tab.
            This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  )
}
