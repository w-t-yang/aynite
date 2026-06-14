import { FileText, Plus } from 'lucide-react'
import { useState } from 'react'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import { Button } from '../../shared/basic/Button'
import { Collapsible } from '../../shared/basic/Collapsible'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { AgentCard, PromptFileRow } from '../../shared/featured/AgentCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { Agent, SettingsState } from '../../shared/lib/types'

interface AgentsTabProps {
  state: {
    agents: SettingsState['agents']
    prompts: SettingsState['prompts']
    mergedPrompt: string
  }
  actions: {
    setAgentsTab: (payload: {
      agents?: SettingsState['agents']
      prompts?: SettingsState['prompts']
    }) => void
    onPickPromptFile: () => Promise<any>
    onRestore?: () => void
    t: (key: string) => string
  }
}

export function AgentsTab({ state, actions }: AgentsTabProps) {
  const { agents, prompts, mergedPrompt } = state
  const { setAgentsTab, onPickPromptFile, t } = actions

  const [fileToDelete, setFileToDelete] = useState<string | null>(null)

  const handleUpdateAgent = (id: string, field: string, value: any) => {
    const list = (agents.list || []).map((a: Agent) =>
      a.id === id ? { ...a, [field]: value } : a,
    )
    setAgentsTab({ agents: { ...agents, list } })
  }

  const handleDeleteAgent = (id: string) => {
    const list = (agents.list || []).filter((a: Agent) => a.id !== id)
    let activeId = agents.activeId
    if (activeId === id) activeId = list[0]?.id || ''
    setAgentsTab({ agents: { ...agents, list, activeId } })
  }

  const handleAddAgent = () => {
    const id = `agent-${Date.now()}`
    const newAgent: Agent = { id, name: 'New Agent', promptFiles: [] }
    const list = [...(agents.list || []), newAgent]
    setAgentsTab({ agents: { ...agents, list, activeId: id } })
  }

  const confirmDeleteGlobalFile = () => {
    if (fileToDelete) {
      const newFiles = (prompts.files || []).filter((f) => f !== fileToDelete)
      setAgentsTab({ prompts: { files: newFiles } })
      setFileToDelete(null)
    }
  }

  return (
    <SettingsPage
      title={t('agents.title')}
      description={t('agents.description')}
      onRestore={actions.onRestore}
    >
      {/* Global System Prompts */}
      <Section
        title={t('agents.globalPrompts.title')}
        description={t('agents.globalPrompts.description')}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const res = await onPickPromptFile()
              if (res?.data) {
                const newFiles = [...(prompts.files || []), res.data]
                setAgentsTab({
                  prompts: { files: Array.from(new Set(newFiles)) },
                })
              }
            }}
            className={ADD_ITEM_BUTTON}
          >
            <Plus size={14} /> {t('agents.globalPrompts.addPrompt')}
          </Button>
        }
      >
        <div className="space-y-2">
          {(prompts.files || []).map((filePath) => (
            <PromptFileRow
              key={filePath}
              filePath={filePath}
              onDelete={() => setFileToDelete(filePath)}
            />
          ))}
          {(!prompts.files || prompts.files.length === 0) && (
            <p className="text-xs text-muted-foreground/50 italic py-4 text-center border border-dashed border-border rounded-lg">
              {t('agents.globalPrompts.noPrompts')}
            </p>
          )}
        </div>
      </Section>

      {/* Agents List */}
      <Section
        title={t('agents.profiles.title')}
        description={t('agents.profiles.description')}
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddAgent}
            className={ADD_ITEM_BUTTON}
          >
            <Plus size={14} /> {t('agents.profiles.addAgent')}
          </Button>
        }
      >
        <div className="space-y-8">
          {(agents.list || []).map((agent: Agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isActive={agents.activeId === agent.id}
              onSetActive={(id) =>
                setAgentsTab({ agents: { ...agents, activeId: id } })
              }
              onUpdate={handleUpdateAgent}
              onDelete={handleDeleteAgent}
              onPickPromptFile={async (id) => {
                const res = await onPickPromptFile()
                if (res?.data) {
                  const agentObj = (agents.list || []).find((a) => a.id === id)
                  const newFiles = [...(agentObj?.promptFiles || []), res.data]
                  handleUpdateAgent(
                    id,
                    'promptFiles',
                    Array.from(new Set(newFiles)),
                  )
                }
              }}
            >
              <div className="pt-2">
                <Collapsible
                  title={t('agents.promptPreview')}
                  icon={FileText}
                  colorClass="border-primary/20"
                  defaultExpanded={false}
                >
                  <div className="p-4 rounded-lg bg-background/50 border border-border/40 font-mono text-[10px] whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {agents.activeId === agent.id ? (
                      mergedPrompt
                    ) : (
                      <span className="text-muted-foreground italic">
                        {t('agents.noPreview')}
                      </span>
                    )}
                  </div>
                </Collapsible>
              </div>
            </AgentCard>
          ))}
        </div>
      </Section>

      {/* Global File Delete Confirmation */}
      <Modal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        title={t('agents.globalPrompts.removeTitle')}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFileToDelete(null)}>
              {t('agents.globalPrompts.removeCancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteGlobalFile}>
              {t('agents.globalPrompts.removeConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t('agents.globalPrompts.removeBody')}{' '}
          <span className="font-bold text-foreground">
            "{fileToDelete?.split(/[/\\]/).pop()}"
          </span>
          ?
        </p>
      </Modal>
    </SettingsPage>
  )
}
