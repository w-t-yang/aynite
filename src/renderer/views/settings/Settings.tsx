import {
  Bot,
  Brain,
  Code,
  Compass,
  Heart,
  Info,
  Keyboard,
  Sparkles,
  Star,
  Sun,
  Terminal,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Locale } from '../../../lib/types/ui'
import { config } from '../../bridge/config'
import { systemMutations } from '../../bridge/system'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { TabButton } from '../../shared/basic/TabButton'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import type { Agent } from '../../shared/lib/types'
import { cn } from '../../shared/lib/utils'
import { AboutTab } from './AboutTab'
import { AgentSettingsTab } from './AgentSettingsTab'
import { AITab } from './AITab'
// Shared Tabs
import { AppearanceTab } from './AppearanceTab'
import { CommandsTab } from './CommandsTab'
import viewConfig from './config.json'
import { KeybindingsTab } from './KeybindingsTab'
import { SkillsTab } from './SkillsTab'
import { ToolsTab } from './ToolsTab'

const _VIEW_NAME = 'settings'

const AYNITE_AGENT_ID = 'aynite'

const AGENT_ICON_MAP: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  bot: Bot,
  brain: Brain,
  code: Code,
  compass: Compass,
  heart: Heart,
  star: Star,
  zap: Zap,
}

function getAgentIcon(iconId?: string) {
  if (iconId && AGENT_ICON_MAP[iconId]) return AGENT_ICON_MAP[iconId]
  return Bot
}

function sortAgents(list: Agent[]): Agent[] {
  return [...list].sort((a, b) => {
    if (a.id === AYNITE_AGENT_ID) return -1
    if (b.id === AYNITE_AGENT_ID) return 1
    return 0
  })
}

interface SettingsProps {
  locale?: Locale
}

export function Settings({ locale: localeProp }: SettingsProps) {
  const [activeTab, setActiveTab] = useState(() => {
    // Read initial tab from hash
    const hash = window.location.hash
    if (hash.startsWith('#tab=')) return hash.replace('#tab=', '')
    return 'about'
  })
  const [agents, setAgents] = useState<Agent[]>([])

  const locale: Locale = localeProp || 'en'

  // Load agents for sidebar
  useEffect(() => {
    config.get('agents').then((res: any) => {
      if (res?.list) setAgents(sortAgents(res.list))
    })
  }, [])

  // Reload on config change — listen for postMessage events (works both
  // inline and in iframe, since AppContext relays events to both).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'aynite:config-changed') {
        config.get('agents').then((res: any) => {
          if (res?.list) setAgents(sortAgents(res.list))
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Listen for tab changes via hash (works universally when rendered inline)
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash
      if (hash.startsWith('#tab=')) {
        setActiveTab(hash.replace('#tab=', ''))
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Load view-specific translations from config.json
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
    // Update hash so that the current tab is reflected in the URL
    window.history.replaceState(null, '', `#tab=${tab}`)
  }, [])

  // ─── Render Tab Content ─────────────────────────────────────────────

  const renderTab = () => {
    // Check for agent-specific tab first
    if (activeTab.startsWith('agent-')) {
      const agentId = activeTab.replace('agent-', '')
      return (
        <AgentSettingsTab
          key={agentId}
          agentId={agentId}
          t={(key: string) => t(key)}
        />
      )
    }

    switch (activeTab) {
      case 'appearance':
        return (
          <AppearanceTab
            onRestore={() => setShowRestoreModal(true)}
            t={(key: string) => t(key)}
          />
        )
      case 'keybindings':
        return (
          <KeybindingsTab
            onRestore={() => setShowRestoreModal(true)}
            t={(key: string) => t(key)}
          />
        )
      case 'ai':
        return (
          <AITab
            onRestore={() => setShowRestoreModal(true)}
            t={(key: string) => t(key)}
          />
        )
      case 'skills':
        return (
          <SkillsTab
            onRestore={() => setShowRestoreModal(true)}
            t={(key: string) => t(key)}
          />
        )
      case 'commands':
        return (
          <CommandsTab
            onRestore={() => setShowRestoreModal(true)}
            t={(key: string) => t(key)}
          />
        )
      case 'tools':
        return (
          <ToolsTab
            onRestore={() => setShowRestoreModal(true)}
            t={(key: string) => t(key)}
          />
        )
      case 'about':
        return (
          <AboutTab
            onOpenExternal={(url: string) => systemMutations.openExternal(url)}
            t={(key: string) => t(key)}
          />
        )
      default:
        return null
    }
  }

  // ─── Restore Confirm Handler ────────────────────────────────────────

  const handleRestoreConfirm = async () => {
    setShowRestoreModal(false)
  }

  return (
    <div className="w-full h-full bg-card flex flex-col text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-60 border-r border-border bg-sidebar/50 p-4 space-y-1 shrink-0 overflow-y-auto custom-scrollbar">
          {/* App group */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mb-2 px-3">
            {t('sidebar.app')}
          </div>
          <TabButton
            active={activeTab === 'about'}
            onClick={() => handleTabChange('about')}
            icon={<Info size={16} />}
            label={t('sidebar.about')}
          />

          {/* Agents group */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            {t('sidebar.agents')}
          </div>
          {agents.map((agent) => {
            const AgentIcon = getAgentIcon(agent.icon)
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => handleTabChange(`agent-${agent.id}`)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === `agent-${agent.id}`
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                <AgentIcon size={16} className="shrink-0" />
                <span className="truncate">{agent.name}</span>
              </button>
            )
          })}

          {/* AI Resources group */}
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

          {/* General group */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 mt-6 mb-2 px-3">
            {t('sidebar.general')}
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
        </div>

        {/* Settings Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col custom-scrollbar relative">
            {renderTab()}
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
            <Button variant="primary" onClick={handleRestoreConfirm}>
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
