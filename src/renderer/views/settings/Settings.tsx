import {
  Bot,
  FileText,
  Info,
  Keyboard,
  MessageCircle,
  Sun,
  Terminal,
  Wrench,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { systemMutations } from '../../bridge/system'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { TabButton } from '../../shared/basic/TabButton'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { useView } from '../ViewContext'
import { AboutTab } from './AboutTab'
import { AgentsTab } from './AgentsTab'
import { AITab } from './AITab'
// Shared Tabs
import { AppearanceTab } from './AppearanceTab'
import { CommandsTab } from './CommandsTab'
import viewConfig from './config.json'
import { KeybindingsTab } from './KeybindingsTab'
import { MessengersTab } from './MessengersTab'
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

  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  // Handle initial tab from hash
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#tab=')) {
      const tab = hash.replace('#tab=', '')
      setActiveTab(tab)
    }
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
  }

  // ─── Render Tab Content ─────────────────────────────────────────────

  const renderTab = () => {
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
      case 'agents':
        return (
          <AgentsTab
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
      case 'messengers':
        return (
          <MessengersTab
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
    // Each tab handles its own restore logic via the onRestore modal flow.
    // When the modal is confirmed, the active tab's internal state handles it.
    setShowRestoreModal(false)
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
          <TabButton
            active={activeTab === 'messengers'}
            onClick={() => handleTabChange('messengers')}
            icon={<MessageCircle size={16} />}
            label={t('sidebar.messengers')}
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
