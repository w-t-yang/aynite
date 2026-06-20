import { FileText, Plus, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ADD_ITEM_BUTTON } from '../../../lib/constants/renderer/styles'
import type { SettingsState } from '../../../lib/types/settings'
import { ai as aiBridge } from '../../bridge/ai'
import { config, configMutations } from '../../bridge/config'
import { system } from '../../bridge/system'
import { Button } from '../../shared/basic/Button'
import { Collapsible } from '../../shared/basic/Collapsible'
import { Section } from '../../shared/basic/Section'
import { Switch } from '../../shared/basic/Switch'
import { AgentCard } from '../../shared/featured/AgentCard'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { Agent } from '../../shared/lib/types'

const ALL_TOOL_IDS = [
  'read_file',
  'write_file',
  'edit_file',
  'list_files',
  'run_command',
  'grep_search',
  'read_url',
  'glob_search',
  'create_task',
  'update_task',
  'get_tasks',
  'propose_plan',
  'initialize_memory',
  'update_memory',
  'read_memory',
  'get_file_tree',
  'get_workspace_info',
]

interface ToolDef {
  id: string
  name: string
  description: string
}

const TOOL_DEFS: ToolDef[] = [
  {
    id: 'read_file',
    name: 'Read File',
    description: 'Read the contents of a file',
  },
  {
    id: 'write_file',
    name: 'Write File',
    description: 'Write content to a file',
  },
  {
    id: 'edit_file',
    name: 'Edit File',
    description: 'Perform surgical edits on a file',
  },
  {
    id: 'list_files',
    name: 'List Files',
    description: 'List files in a directory',
  },
  {
    id: 'run_command',
    name: 'Run Command',
    description: 'Execute shell commands',
  },
  {
    id: 'grep_search',
    name: 'Grep Search',
    description: 'Search for regex patterns',
  },
  { id: 'read_url', name: 'Read URL', description: 'Fetch content from a URL' },
  {
    id: 'glob_search',
    name: 'Glob Search',
    description: 'Search files by glob pattern',
  },
  {
    id: 'create_task',
    name: 'Create Task',
    description: 'Initialize a task list',
  },
  { id: 'update_task', name: 'Update Task', description: 'Update task status' },
  { id: 'get_tasks', name: 'Get Tasks', description: 'Read current task list' },
  {
    id: 'propose_plan',
    name: 'Propose Plan',
    description: 'Create an implementation plan',
  },
  {
    id: 'initialize_memory',
    name: 'Initialize Memory',
    description: 'Scan project for memory',
  },
  {
    id: 'update_memory',
    name: 'Update Memory',
    description: 'Update project memory',
  },
  {
    id: 'read_memory',
    name: 'Read Memory',
    description: 'Read project memory',
  },
  {
    id: 'get_file_tree',
    name: 'Get File Tree',
    description: 'Get file tree of a directory',
  },
  {
    id: 'get_workspace_info',
    name: 'Workspace Info',
    description: 'Get workspace information',
  },
]

interface AgentsTabProps {
  onRestore?: () => void
  t: (key: string) => string
}

export function AgentsTab({ onRestore, t }: AgentsTabProps) {
  const [agents, setAgents] = useState<SettingsState['agents'] | null>(null)
  const [_prompts, setPrompts] = useState<SettingsState['prompts']>({
    files: [],
  })
  const [mergedPrompt, setMergedPrompt] = useState('')
  const [loading, setLoading] = useState(true)

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
    async (updatedAgents: SettingsState['agents']) => {
      setAgents(updatedAgents)
      await configMutations.set('agents', {
        activeId: updatedAgents.activeId,
        list: updatedAgents.list,
      } as any)
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
    const newAgent: Agent = {
      id,
      name: 'New Agent',
      promptFiles: [],
      tools: Object.fromEntries(ALL_TOOL_IDS.map((tid) => [tid, true])),
    }
    const list = [...(agents.list || []), newAgent]
    persist({ ...agents, list, activeId: id })
  }, [agents, persist])

  const handleToggleTool = useCallback(
    (agentId: string, toolId: string) => {
      if (!agents) return
      const list = (agents.list || []).map((a: Agent) => {
        if (a.id !== agentId) return a
        const currentTools = a.tools || {}
        return {
          ...a,
          tools: { ...currentTools, [toolId]: !currentTools[toolId] },
        }
      })
      persist({ ...agents, list })
    },
    [agents, persist],
  )

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
              {/* Per-agent tools section */}
              <div className="pt-4">
                <Collapsible
                  title="Tools"
                  icon={Wrench}
                  colorClass="border-primary/20"
                  defaultExpanded={false}
                >
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {TOOL_DEFS.map((tool) => {
                      const agentTools = agent.tools || {}
                      const isEnabled = agentTools[tool.id] !== false
                      return (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between p-2 rounded-lg border border-border/40 bg-accent/5 hover:bg-accent/10 transition-all group"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider">
                              {tool.name}
                            </h4>
                            <p className="text-[9px] text-muted-foreground/70 truncate">
                              {tool.description}
                            </p>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() =>
                              handleToggleTool(agent.id, tool.id)
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                </Collapsible>
              </div>

              {/* Prompt Preview */}
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
    </SettingsPage>
  )
}
