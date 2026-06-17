import { FileText, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import type { SettingsState } from '../../../lib/types/settings'
import { ai as aiBridge } from '../../bridge/ai'
import { config, configMutations } from '../../bridge/config'
import { system } from '../../bridge/system'
import { Button } from '../../shared/basic/Button'
import { Collapsible } from '../../shared/basic/Collapsible'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { AgentCard, PromptFileRow } from '../../shared/featured/AgentCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { Agent } from '../../shared/lib/types'

interface AgentsTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function AgentsTab({ onRestore, t }: AgentsTabProps) {
  const [agents, setAgents] = useState<SettingsState['agents'] | null>(null)
  const [prompts, setPrompts] = useState<SettingsState['prompts']>({
    files: [],
  })
  const [mergedPrompt, setMergedPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [fileToDelete, setFileToDelete] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [resAgents, resPrompts] = await Promise.all([
        config.get('agents'),
        config.get('prompts'),
      ])

      const agentsData = resAgents as any
      const normalizedPrompts =
        resPrompts?.files || (resPrompts as any)?.list || []

      if (agentsData) {
        setAgents({
          activeId: agentsData.activeId,
          list: agentsData.list || [],
        })

        const merged = await aiBridge.getMergedSystemPrompt(
          normalizedPrompts,
          (agentsData.list || []).find((a: any) => a.id === agentsData.activeId)
            ?.promptFiles || [],
        )
        setMergedPrompt(merged || '')
      }
      setPrompts({ files: normalizedPrompts })
      setLoading(false)
    }
    load()
  }, [])

  const persist = useCallback(
    async (
      updatedAgents: SettingsState['agents'],
      updatedPrompts?: SettingsState['prompts'],
    ) => {
      setAgents(updatedAgents)
      if (updatedPrompts !== undefined) setPrompts(updatedPrompts)
      await configMutations.set('agents', {
        activeId: updatedAgents.activeId,
        list: updatedAgents.list,
      } as any)
      if (updatedPrompts !== undefined) {
        await configMutations.set('prompts', {
          files: updatedPrompts.files,
        } as any)
      }
    },
    [],
  )

  const handleUpdateAgent = useCallback(
    (id: string, field: string, value: any) => {
      if (!agents) return
      const list = (agents.list || []).map((a: Agent) =>
        a.id === id ? { ...a, [field]: value } : a,
      )
      persist({ ...agents, list })
    },
    [agents, persist],
  )

  const handleDeleteAgent = useCallback(
    (id: string) => {
      if (!agents) return
      const list = (agents.list || []).filter((a: Agent) => a.id !== id)
      let activeId = agents.activeId
      if (activeId === id) activeId = list[0]?.id || ''
      persist({ ...agents, list, activeId })
    },
    [agents, persist],
  )

  const handleAddAgent = useCallback(() => {
    if (!agents) return
    const id = `agent-${Date.now()}`
    const newAgent: Agent = { id, name: 'New Agent', promptFiles: [] }
    const list = [...(agents.list || []), newAgent]
    persist({ ...agents, list, activeId: id })
  }, [agents, persist])

  const confirmDeleteGlobalFile = useCallback(() => {
    if (fileToDelete) {
      const newFiles = (prompts.files || []).filter((f) => f !== fileToDelete)
      persist(agents || { activeId: '', list: [] }, { files: newFiles })
      setFileToDelete(null)
    }
  }, [fileToDelete, prompts, agents, persist])

  const handlePickPromptFile = useCallback(async () => {
    const file = await system.selectFile({
      title: 'Select Prompt File',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    return file ? { data: file } : null
  }, [])

  if (loading || !agents) {
    return (
      <SettingsPage
        title={t('agents.title')}
        description={t('agents.description')}
      >
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      </SettingsPage>
    )
  }

  return (
    <SettingsPage
      title={t('agents.title')}
      description={t('agents.description')}
      onRestore={onRestore}
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
              const res = await handlePickPromptFile()
              if (res?.data) {
                const newFiles = [...(prompts.files || []), res.data]
                persist(agents, {
                  files: Array.from(new Set(newFiles)) as string[],
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
              onSetActive={(id) => persist({ ...agents, activeId: id })}
              onUpdate={handleUpdateAgent}
              onDelete={handleDeleteAgent}
              onPickPromptFile={async (id) => {
                const res = await handlePickPromptFile()
                if (res?.data) {
                  const agentObj = (agents.list || []).find((a) => a.id === id)
                  const newFiles = [...(agentObj?.promptFiles || []), res.data]
                  handleUpdateAgent(
                    id,
                    'promptFiles',
                    Array.from(new Set(newFiles)) as string[],
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
