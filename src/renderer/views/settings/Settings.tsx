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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_AI_CONFIG, DEFAULT_AI_TOOLS } from '../../../lib/constants/ai'
import { DEFAULT_KEYBINDINGS } from '../../../lib/constants/keybindings'
import type { Theme } from '../../../lib/constants/types'
import { ai as aiBridge, aiMutations } from '../../bridge/ai'
import { config, configMutations } from '../../bridge/config'
import { spells, spellsMutations } from '../../bridge/spells'
import { system as bridgeSystem, systemMutations } from '../../bridge/system'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { TabButton } from '../../shared/basic/TabButton'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import type { SettingsState } from '../../shared/lib/types'
import { useView } from '../ViewContext'
import { AboutTab } from './AboutTab'
import { AgentsTab } from './AgentsTab'
import { AITab } from './AITab'
// Shared Tabs
import { AppearanceTab } from './AppearanceTab'
import { CommandsTab } from './CommandsTab'
import viewConfig from './config.json'
import { KeybindingsTab } from './KeybindingsTab'
import { SkillsTab } from './SkillsTab'
import { ToolsTab } from './ToolsTab'

const _VIEW_NAME = 'settings'

export function Settings() {
  const [activeTab, setActiveTab] = useState('appearance')
  const { locale } = useView()

  // Load view-specific translations from config.json
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

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
      config.get('ai'),
      config.get('agents'),
      config.get('prompts'),
      config.get('keybindings'),
      config.get('skills'),
      spells.getAvailableSkills(),
      config.get('commands'),
      spells.getAvailableCommands(),
      config.get('tools'),
    ])

    if (resAI) setAI({ activeId: resAI.activeId, providers: resAI.providers })
    const normalizedGlobalPrompts = resPrompts?.files || resPrompts?.list || []
    if (resAgents) {
      setAgents({ activeId: resAgents.activeId, list: resAgents.list })

      // Load merged prompt for active agent
      const merged = await aiBridge.getMergedSystemPrompt(
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
    const systemFonts = await bridgeSystem.getSystemFonts()
    setThemes({
      list: contextThemes,
      activeId: activeThemeId,
      systemFonts,
    })
  }, [contextThemes, activeThemeId])

  const loadVersion = useCallback(async () => {
    const version = await config.get('version')
    setAppVersion(version)
  }, [])

  useEffect(() => {
    loadSettings()
    loadVersion()

    // Handle initial tab from hash
    const hash = window.location.hash
    if (hash.startsWith('#tab=')) {
      const tab = hash.replace('#tab=', '')
      setActiveTab(tab)
    }
  }, [loadVersion, loadSettings])

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
    if (newThemes.list.length === 0) {
      await loadSettings()
    }
  }

  const handleSetKeybindings = async (kb: SettingsState['keybindings']) => {
    setKeybindings(kb)
    await configMutations.set('keybindings', { list: kb } as any)
  }

  const handleSetAI = async (newAI: SettingsState['ai']) => {
    setAI(newAI)
    await configMutations.set('ai', {
      activeId: newAI.activeId,
      providers: newAI.providers,
    } as any)
  }

  const handleSetSkills = async (newSkills: any) => {
    setSkills(newSkills)
    await configMutations.set('skills', newSkills)
  }

  const handleSetCommands = async (newCommands: any) => {
    setCommands(newCommands)
    await configMutations.set('commands', newCommands)
  }

  const handleSetTools = async (newTools: SettingsState['aiTools']) => {
    setAiTools(newTools)
    await configMutations.set('tools', {
      active: newTools,
      list: availableTools,
    } as any)
  }

  const handlePickSkillFolder = async () => {
    const folder = await spellsMutations.pickSkillFolder()
    if (folder) {
      const newFolders = Array.from(
        new Set([...(skills?.folders || []), folder]),
      )
      await handleSetSkills({ folders: newFolders })
      await loadSettings()
    }
  }

  const handlePickCommandFolder = async () => {
    const folder = await spellsMutations.pickCommandFolder()
    if (folder) {
      const newFolders = Array.from(
        new Set([...(commands?.folders || []), folder]),
      )
      await handleSetCommands({ folders: newFolders })
      await loadSettings()
    }
  }

  const handlePickPromptFile = async () => {
    const file = await bridgeSystem.selectFile({
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
        {t('loading')}
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-card flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-52 border-r border-border bg-sidebar/50 p-4 space-y-1 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2 px-3">
            {t('sidebar.basic')}
          </div>
          <TabButton
            active={activeTab === 'appearance'}
            onClick={() => handleTabChange('appearance')}
            icon={<Sun size={16} />}
            label={t('sidebar.appearance')}
          />
          <TabButton
            active={activeTab === 'keybindings'}
            onClick={() => handleTabChange('keybindings')}
            icon={<Keyboard size={16} />}
            label={t('sidebar.keybindings')}
          />

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            {t('sidebar.ai')}
          </div>
          <TabButton
            active={activeTab === 'ai'}
            onClick={() => handleTabChange('ai')}
            icon={<Bot size={16} />}
            label={t('sidebar.providers')}
          />
          <TabButton
            active={activeTab === 'agents'}
            onClick={() => handleTabChange('agents')}
            icon={<FileText size={16} />}
            label={t('sidebar.agents')}
          />
          <TabButton
            active={activeTab === 'tools'}
            onClick={() => handleTabChange('tools')}
            icon={<Wrench size={16} />}
            label={t('sidebar.tools')}
          />
          <TabButton
            active={activeTab === 'skills'}
            onClick={() => handleTabChange('skills')}
            icon={<Zap size={16} />}
            label={t('sidebar.skills')}
          />
          <TabButton
            active={activeTab === 'commands'}
            onClick={() => handleTabChange('commands')}
            icon={<Terminal size={16} />}
            label={t('sidebar.commands')}
          />

          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            {t('sidebar.app')}
          </div>
          <TabButton
            active={activeTab === 'about'}
            onClick={() => handleTabChange('about')}
            icon={<Info size={16} />}
            label={t('sidebar.about')}
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
                  t: (key: string) => t(key),
                }}
              />
            )}

            {activeTab === 'keybindings' && (
              <KeybindingsTab
                state={{ keybindings }}
                actions={{
                  setKeybindings: handleSetKeybindings,
                  onRestore: () => setShowRestoreModal(true),
                  t: (key: string) => t(key),
                }}
              />
            )}

            {activeTab === 'ai' && (
              <AITab
                state={{ ai }}
                actions={{
                  setAI: handleSetAI,
                  onRestore: () => setShowRestoreModal(true),
                  t: (key: string) => t(key),
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
                      await configMutations.set('agents', {
                        activeId: payload.agents.activeId,
                        list: payload.agents.list,
                      } as any)
                    }
                    if (payload.prompts) {
                      setPrompts(payload.prompts)
                      await configMutations.set('prompts', {
                        files: payload.prompts.files,
                      } as any)
                    }
                    await loadSettings()
                  },
                  onPickPromptFile: handlePickPromptFile,
                  onRestore: () => setShowRestoreModal(true),
                  t: (key: string) => t(key),
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
                  t: (key: string) => t(key),
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
                  t: (key: string) => t(key),
                }}
              />
            )}

            {activeTab === 'tools' && (
              <ToolsTab
                state={{ aiTools, availableTools }}
                actions={{
                  setTools: handleSetTools,
                  onRestore: () => setShowRestoreModal(true),
                  t: (key: string) => t(key),
                }}
              />
            )}

            {activeTab === 'about' && (
              <AboutTab
                state={{
                  appVersion,
                }}
                actions={{
                  onOpenExternal: (url) => systemMutations.openExternal(url),
                  t: (key: string) => t(key),
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
        title={t('restore.title').replace(
          '{tab}',
          activeTab.charAt(0).toUpperCase() + activeTab.slice(1),
        )}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRestoreModal(false)}>
              {t('restore.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (activeTab === 'appearance') {
                  await setContextTheme('light')
                  await loadSettings()
                }
                if (activeTab === 'keybindings') {
                  await configMutations.set('keybindings', {
                    list: DEFAULT_KEYBINDINGS,
                  } as any)
                  await loadSettings()
                }
                if (activeTab === 'ai') {
                  await configMutations.set('ai', {
                    activeId: DEFAULT_AI_CONFIG.activeId,
                    list: DEFAULT_AI_CONFIG.providers,
                  } as any)
                  await loadSettings()
                }
                if (activeTab === 'agents') {
                  await aiMutations.restorePrompts()
                  await loadSettings()
                }
                if (activeTab === 'skills') {
                  await spellsMutations.restoreSkills()
                  await loadSettings()
                }
                if (activeTab === 'commands') {
                  await spellsMutations.restoreCommands()
                  await loadSettings()
                }
                if (activeTab === 'tools') {
                  await configMutations.set('tools', {
                    active: DEFAULT_AI_TOOLS,
                    list: availableTools,
                  } as any)
                  await loadSettings()
                }
                setShowRestoreModal(false)
              }}
            >
              {t('restore.confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            {t('restore.body').replace('{tab}', activeTab)}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('restore.warning')}
          </p>
        </div>
      </Modal>
    </div>
  )
}
