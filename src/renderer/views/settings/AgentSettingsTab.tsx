import {
  Bot,
  Brain,
  Code,
  Compass,
  ExternalLink,
  FileText,
  Heart,
  Info,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  ADD_ITEM_BUTTON,
  GRID_2_COL,
} from '../../../lib/constants/renderer/styles'
import type { MessengerConfig } from '../../../lib/types/ai'
import { config, configMutations } from '../../bridge/config'
import { file } from '../../bridge/file'
import { system } from '../../bridge/system'
import { Button } from '../../shared/basic/Button'
import { Collapsible } from '../../shared/basic/Collapsible'
import { Input } from '../../shared/basic/Input'
import { Section } from '../../shared/basic/Section'
import { Switch } from '../../shared/basic/Switch'
import { MessengerEditModal } from '../../shared/featured/MessengerEditModal'
import { SettingsPage } from '../../shared/featured/SettingsPage'
import type { Agent } from '../../shared/lib/types'
import { cn } from '../../shared/lib/utils'

interface AgentSettingsTabProps {
  agentId: string
  t: (key: string) => string
}

interface ToolDef {
  id: string
  name: string
  description: string
}

const ICON_OPTIONS = [
  { id: 'sparkles', Icon: Sparkles },
  { id: 'bot', Icon: Bot },
  { id: 'brain', Icon: Brain },
  { id: 'code', Icon: Code },
  { id: 'compass', Icon: Compass },
  { id: 'zap', Icon: Zap },
  { id: 'star', Icon: Star },
  { id: 'heart', Icon: Heart },
]

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

// ─── Component ─────────────────────────────────────────────────────────

export function AgentSettingsTab({ agentId }: AgentSettingsTabProps) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [allAgents, setAllAgents] = useState<{
    list: Agent[]
    activeId: string
  } | null>(null)
  const [messengers, setMessengers] = useState<MessengerConfig[]>([])
  const [loading, setLoading] = useState(true)

  // Edit modal state
  const [editingMessenger, setEditingMessenger] =
    useState<MessengerConfig | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [resAgents, resMessengers] = await Promise.all([
        config.get('agents'),
        config.get('messengers'),
      ])
      const agentsData = resAgents as { activeId: string; list: Agent[] } | null
      if (agentsData) {
        setAllAgents(agentsData)
        const found = agentsData.list.find((a) => a.id === agentId)
        if (found) setAgent(found)
      }
      if (Array.isArray(resMessengers)) {
        setMessengers(resMessengers as MessengerConfig[])
      }
      setLoading(false)
    }
    load()
  }, [agentId])

  const persist = useCallback(
    async (updatedAgent: Agent) => {
      setAgent(updatedAgent)
      if (!allAgents) return
      const list = allAgents.list.map((a) =>
        a.id === updatedAgent.id ? updatedAgent : a,
      )
      await configMutations.set('agents', {
        activeId: allAgents.activeId,
        list,
      } as any)
    },
    [allAgents],
  )

  const handleNameChange = useCallback(
    (value: string) => {
      if (!agent) return
      persist({ ...agent, name: value })
    },
    [agent, persist],
  )

  const handleIntroductionChange = useCallback(
    (value: string) => {
      if (!agent) return
      persist({ ...agent, introduction: value || undefined })
    },
    [agent, persist],
  )

  const handleIconChange = useCallback(
    (icon: string) => {
      if (!agent) return
      persist({ ...agent, icon })
    },
    [agent, persist],
  )

  const handleToggleTool = useCallback(
    (toolId: string) => {
      if (!agent) return
      const currentTools = agent.tools || {}
      persist({
        ...agent,
        tools: { ...currentTools, [toolId]: !currentTools[toolId] },
      })
    },
    [agent, persist],
  )

  const handleAddPromptFile = useCallback(async () => {
    if (!agent) return
    const files = await system.selectFile({
      title: 'Select Prompt File',
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (files && files.length > 0) {
      const newFiles: string[] = Array.from(
        new Set([...(agent.promptFiles || []), ...files]),
      )
      persist({ ...agent, promptFiles: newFiles })
    }
  }, [agent, persist])

  const handleRemovePromptFile = useCallback(
    (filePath: string) => {
      if (!agent) return
      const newFiles = (agent.promptFiles || []).filter((f) => f !== filePath)
      persist({ ...agent, promptFiles: newFiles })
    },
    [agent, persist],
  )

  // Build system prompt preview
  const [systemPromptPreview, setSystemPromptPreview] = useState('')

  useEffect(() => {
    if (!agent) return
    const buildPreview = async () => {
      const header = `My name is ${agent.name}.${agent.introduction ? ` ${agent.introduction}` : ''}`
      let merged = `${header}\n\n`
      const files = agent.promptFiles || []
      for (const filePath of files) {
        try {
          const content = await file.read(filePath)
          if (content) {
            merged += `${content}\n\n`
          }
        } catch {
          merged += `[Error reading: ${filePath}]\n\n`
        }
      }
      setSystemPromptPreview(merged.trim())
    }
    buildPreview()
  }, [agent])

  // ─── Messenger helpers ──────────────────────────────────────────────

  const handleOpenGuide = useCallback(() => {
    window.open(
      'https://core.telegram.org/bots#how-do-i-create-a-bot',
      '_blank',
    )
  }, [])

  const handleEditMessenger = useCallback((m: MessengerConfig | null) => {
    setEditingMessenger(m)
    setShowEditModal(true)
  }, [])

  const handleCloseEdit = useCallback(() => {
    setEditingMessenger(null)
    setShowEditModal(false)
    // Reload messengers to reflect any changes made in the modal
    config.get('messengers').then((res: any) => {
      if (Array.isArray(res)) setMessengers(res as MessengerConfig[])
    })
  }, [])

  const handleDeleteMessenger = useCallback(
    async (id: string) => {
      const updated = messengers.filter((m) => m.id !== id)
      setMessengers(updated)
      await configMutations.set('messengers', updated)
    },
    [messengers],
  )

  if (loading || !agent) {
    return (
      <SettingsPage title={agent?.name || 'Agent'} description="">
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading...
        </div>
      </SettingsPage>
    )
  }

  const boundMessengers = messengers.filter((m) => m.agentId === agent.id)

  return (
    <SettingsPage title={agent.name} description="">
      {/* Identity */}
      <Section title="Identity" description="Agent name and identifier">
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label
                htmlFor="agent-name"
                className="text-xs font-medium text-muted-foreground mb-1 block"
              >
                Name
              </label>
              <Input
                id="agent-name"
                value={agent.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Agent Name"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="agent-id"
                className="text-xs font-medium text-muted-foreground mb-1 block"
              >
                ID
              </label>
              <Input
                id="agent-id"
                value={agent.id}
                disabled
                placeholder="Agent ID"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="agent-introduction"
              className="text-xs font-medium text-muted-foreground mb-1 block"
            >
              Introduction
            </label>
            <textarea
              id="agent-introduction"
              value={agent.introduction || ''}
              onChange={(e) => handleIntroductionChange(e.target.value)}
              placeholder="Describe this agent's role and personality..."
              className="w-full bg-transparent border border-border/60 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50 resize-none"
              rows={3}
            />
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-2 block">
              Icon
            </span>
            <div className="flex items-center gap-2">
              {ICON_OPTIONS.map(({ id, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleIconChange(id)}
                  className={cn(
                    'p-2 rounded-lg border transition-all',
                    (agent.icon || 'sparkles') === id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Messengers */}
      <Section
        title="Messengers"
        description="Messenger bots bound to this agent."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditMessenger(null)}
            className={ADD_ITEM_BUTTON}
          >
            <Plus size={14} /> Add Bot
          </Button>
        }
      >
        {boundMessengers.length > 0 ? (
          <div className="space-y-3">
            {boundMessengers.map((m) => (
              <div
                key={m.id}
                className="flex items-start gap-3 p-4 rounded-xl border border-border/40 bg-accent/5"
              >
                <div className="shrink-0 mt-0.5">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full block',
                      m.enabled && m.connected ? 'bg-green-500' : 'bg-red-400',
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider',
                        m.provider === 'telegram'
                          ? 'text-blue-400'
                          : 'text-indigo-400',
                      )}
                    >
                      {m.provider === 'telegram' ? 'Telegram' : 'Discord'}
                    </span>
                    {m.botName && (
                      <span className="text-xs text-muted-foreground">
                        · {m.botName}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground/50">
                      {m.enabled && m.connected
                        ? 'Connected'
                        : m.enabled
                          ? 'Disconnected'
                          : 'Disabled'}
                    </span>

                    {/* Edit / Delete buttons */}
                    <button
                      type="button"
                      onClick={() => handleEditMessenger(m)}
                      className="p-1 text-muted-foreground/40 hover:text-foreground hover:bg-accent/30 rounded transition-all"
                      title="Edit messenger"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMessenger(m.id)}
                      className="p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-all"
                      title="Delete messenger"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Trusted users & default project folder */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    {m.whitelist && m.whitelist.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/50">
                        Trusted Users: {m.whitelist.join(', ')}
                      </span>
                    )}
                    {m.projectFolder && (
                      <span className="text-[10px] text-muted-foreground/50 truncate max-w-[200px]">
                        Default Project: {m.projectFolder}
                      </span>
                    )}
                  </div>

                  {/* Hard-coded error message instead of raw error */}
                  {m.enabled && !m.connected && (
                    <div className="flex flex-col gap-2 mt-1">
                      <div className="flex items-start gap-1.5">
                        <Info
                          size={12}
                          className="mt-0.5 shrink-0 text-red-400"
                        />
                        <span className="text-[11px] text-red-400/80 leading-tight">
                          Failed to connect. Please check your API key and
                          ensure the bot is configured correctly.
                        </span>
                      </div>
                      <div className="flex items-center gap-3 ml-[22px]">
                        <button
                          type="button"
                          onClick={handleOpenGuide}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary/70 hover:text-primary bg-transparent border-none p-0 cursor-pointer transition-colors"
                        >
                          <ExternalLink size={11} />
                          Setup Guide
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditMessenger(m)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary/70 hover:text-primary bg-transparent border-none p-0 cursor-pointer transition-colors"
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 border-2 border-dashed border-border rounded-xl opacity-50">
            <MessageCircle size={20} className="mr-2 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              No messenger bots bound to this agent.
            </span>
          </div>
        )}
      </Section>

      {/* Prompt Files */}
      <Section
        title="Prompt Files"
        description="Markdown files that define this agent's behavior and instructions."
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddPromptFile}
            className={ADD_ITEM_BUTTON}
          >
            <Plus size={14} /> Add File
          </Button>
        }
      >
        <div className="space-y-2">
          {(agent.promptFiles || []).length > 0 ? (
            (agent.promptFiles || []).map((filePath) => (
              <div
                key={filePath}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-accent/5 group"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium truncate block">
                    {filePath.split(/[/\\]/).pop()}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {filePath}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemovePromptFile(filePath)}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground/50 italic py-4 text-center border border-dashed border-border rounded-lg">
              No prompt files configured.
            </p>
          )}
        </div>

        {/* System Prompt Preview */}
        <div className="mt-6">
          <Collapsible
            title="System Prompt Preview"
            icon={FileText}
            colorClass="border-primary/20"
            defaultExpanded={false}
          >
            <div className="p-4 rounded-lg bg-background/50 border border-border/40 font-mono text-[10px] whitespace-pre-wrap max-h-60 overflow-y-auto">
              {systemPromptPreview || (
                <span className="text-muted-foreground italic">
                  No prompt files configured.
                </span>
              )}
            </div>
          </Collapsible>
        </div>
      </Section>

      {/* Tools */}
      <Section
        title="Tools"
        description="Toggle which tools this agent can use."
      >
        <div className={GRID_2_COL}>
          {TOOL_DEFS.map((tool) => {
            const agentTools = agent.tools || {}
            const isEnabled = agentTools[tool.id] !== false
            return (
              <div
                key={tool.id}
                className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-accent/5 hover:bg-accent/10 transition-all group"
              >
                <div className="space-y-1 flex-1 min-w-0 pr-6">
                  <h4 className="text-sm font-bold uppercase tracking-wider">
                    {tool.name}
                  </h4>
                  <p className="text-[11px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={() => handleToggleTool(tool.id)}
                />
              </div>
            )
          })}
        </div>
      </Section>

      {/* ─── Edit Messenger Modal ────────────────────────────────────── */}
      <MessengerEditModal
        isOpen={showEditModal}
        onClose={handleCloseEdit}
        existing={editingMessenger}
        agentId={agent.id}
      />
    </SettingsPage>
  )
}
