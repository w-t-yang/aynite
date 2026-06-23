import {
  Bot as BotIcon,
  Brain,
  Code,
  Compass,
  Download,
  Folder as FolderIcon,
  FolderOpen,
  Headphones,
  Heart,
  Home,
  Layout as LayoutIcon,
  MessageCircle,
  Plus,
  Rss,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import appIcon from '../../../../build/icon-64.png'
import {
  ADD_ITEM_BUTTON,
  GRID_2_COL,
} from '../../../lib/constants/renderer/styles'
import type { LayoutNode } from '../../../lib/constants/types'
import type { Agent, MessengerConfig } from '../../../lib/types/ai'
import { ai } from '../../bridge/ai'
import { config, configMutations } from '../../bridge/config'
import { events } from '../../bridge/events'
import { spells, spellsMutations } from '../../bridge/spells'
import { homedir } from '../../bridge/utils'
import { workspace, workspaceMutations } from '../../bridge/workspace'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { Section } from '../../shared/basic/Section'
import { SessionCard, type SessionEntry } from '../../shared/basic/SessionCard'
import { MessengerEditModal } from '../../shared/featured/MessengerEditModal'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useAppEventSubscriber, useView } from '../ViewContext'
import viewConfig from './config.json'

const AYNITE_AGENT_ID = 'aynite'

function countEnabledTools(agent: Agent): number {
  if (!agent.tools) return 0
  return Object.values(agent.tools).filter(Boolean).length
}

function sortAgents(list: Agent[]): Agent[] {
  return [...list].sort((a, b) => {
    if (a.id === AYNITE_AGENT_ID) return -1
    if (b.id === AYNITE_AGENT_ID) return 1
    return 0
  })
}

interface SkillEntry {
  name: string
  description: string
  path: string
  error?: string
}

interface LayoutEntry {
  id: string
  name: string
  icon?: string
  description?: string
  system?: boolean
}

type DashboardData = {
  agents: { list: Agent[]; activeId: string }
  folders: string[]
  skills: { folders: string[]; items: SkillEntry[] }
  sessions: SessionEntry[]
  messengers: MessengerConfig[]
  activityCounts: Record<string, number>
  messengerSessionCount: number
  layouts: LayoutEntry[]
  activeLayoutId: string
}

// ── Activity histogram helpers ─────────────────────────────────────────

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

/**
 * Generate a full 365-day grid ending at today using combined activity counts
 * from all workspaces and messenger bots.
 * Returns 53 weeks, each with 7 DayBin (Sun=index 0, Sat=index 6).
 * Every day has a count (0 means no activity).
 * The grid is oldest→newest left→right.
 */
function buildFullYearGrid(activityCounts: Record<string, number>) {
  let maxCount = 0
  for (const c of Object.values(activityCounts)) {
    if (c > maxCount) maxCount = c
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days: { date: string; count: number; sessionCount: number }[] = []

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${day}`
    const count = activityCounts[dateStr] || 0
    days.push({
      date: dateStr,
      count,
      sessionCount: count,
    })
  }

  // Pad start to align first day with Sunday (row 0)
  const [y0, m0, d0] = days[0].date.split('-').map(Number)
  const firstDate = new Date(y0, m0 - 1, d0)
  const firstDayOfWeek = firstDate.getDay()
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.unshift({ date: '', count: 0, sessionCount: 0 })
  }

  // Group into weeks (Sunday first = index 0)
  const weeks: { date: string; count: number; sessionCount: number }[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }

  return { weeks, maxCount }
}

const INTENSITY_COLORS = [
  'bg-accent/5',
  'bg-primary/15 dark:bg-primary/20',
  'bg-primary/30 dark:bg-primary/35',
  'bg-primary/45 dark:bg-primary/50',
  'bg-primary/60 dark:bg-primary/65',
  'bg-primary/80 dark:bg-primary/85',
]

function getIntensityClass(count: number, max: number): string {
  if (count === 0) return INTENSITY_COLORS[0]
  if (max === 0) return INTENSITY_COLORS[1]
  const ratio = count / max
  if (ratio <= 0.1) return INTENSITY_COLORS[1]
  if (ratio <= 0.25) return INTENSITY_COLORS[2]
  if (ratio <= 0.5) return INTENSITY_COLORS[3]
  if (ratio <= 0.75) return INTENSITY_COLORS[4]
  return INTENSITY_COLORS[5]
}

// ── Component ──────────────────────────────────────────────────────────

export function HomeView() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [
        agentsRaw,
        foldersRaw,
        skillsRaw,
        skillsCfg,
        sessionsRaw,
        messengersRaw,
        activityCounts,
        messengerSessionCount,
        wsConfigs,
        activeWsId,
      ] = await Promise.all([
        config.get('agents'),
        workspace.folders(),
        spells.getAvailableSkills(),
        config.get('skills'),
        ai.listSessions(),
        config.get('messengers'),
        ai.getActivityCounts(),
        ai.getMessengerSessionCount(),
        config.get('workspaces'),
        config.get('activeWorkspace'),
      ])
      if (cancelled) return
      const agentsData = agentsRaw as { activeId: string; list: Agent[] } | null
      const wsList = (wsConfigs as unknown as any[]) || []
      const currentWs = wsList.find((w: any) => w.id === activeWsId)
      setData({
        agents: agentsData || { list: [], activeId: '' },
        folders: foldersRaw || [],
        skills: {
          folders: (skillsCfg as { folders?: string[] })?.folders || [],
          items: (skillsRaw || []) as SkillEntry[],
        },
        sessions: (sessionsRaw || []) as SessionEntry[],
        messengers: (messengersRaw || []) as MessengerConfig[],
        activityCounts: activityCounts || {},
        messengerSessionCount: messengerSessionCount || 0,
        layouts: (currentWs?.layouts as LayoutEntry[]) || [],
        activeLayoutId: currentWs?.activeLayoutId || '',
      })
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleAddFolder = async () => {
    const folder = await workspaceMutations.addFolder()
    if (folder && data) {
      setData({ ...data, folders: [...data.folders, folder] })
    }
  }

  const subscribeToAppEvents = useAppEventSubscriber()

  const reloadData = useCallback(async () => {
    const [
      agentsRaw,
      foldersRaw,
      skillsRaw,
      skillsCfg,
      sessionsRaw,
      messengersRaw,
      activityCounts,
      messengerSessionCount,
      wsConfigs,
      activeWsId,
    ] = await Promise.all([
      config.get('agents'),
      workspace.folders(),
      spells.getAvailableSkills(),
      config.get('skills'),
      ai.listSessions(),
      config.get('messengers'),
      ai.getActivityCounts(),
      ai.getMessengerSessionCount(),
      config.get('workspaces'),
      config.get('activeWorkspace'),
    ])
    const agentsData = agentsRaw as { activeId: string; list: Agent[] } | null
    const wsList = (wsConfigs as unknown as any[]) || []
    const currentWs = wsList.find((w: any) => w.id === activeWsId)
    setData({
      agents: agentsData || { list: [], activeId: '' },
      folders: foldersRaw || [],
      skills: {
        folders: (skillsCfg as { folders?: string[] })?.folders || [],
        items: (skillsRaw || []) as SkillEntry[],
      },
      sessions: (sessionsRaw || []) as SessionEntry[],
      messengers: (messengersRaw || []) as MessengerConfig[],
      activityCounts: activityCounts || {},
      messengerSessionCount: messengerSessionCount || 0,
      layouts: (currentWs?.layouts as LayoutEntry[]) || [],
      activeLayoutId: currentWs?.activeLayoutId || '',
    })
  }, [])

  useEffect(() => {
    const unsub = subscribeToAppEvents((event: any) => {
      if (event.type === 'workspace-changed') reloadData()
      if (event.type === 'config-changed') reloadData()
    })
    return () => unsub()
  }, [subscribeToAppEvents, reloadData])

  const handleSelectSession = useCallback(async (sessionId: string) => {
    events.execute('OPEN_SESSION', { sessionId })
  }, [])

  // ── Add Shortcut modal ───────────────────────────────────────────────
  const [showAddShortcutModal, setShowAddShortcutModal] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const presetScrollRef = useRef<HTMLDivElement>(null)

  const handleAddShortcut = useCallback(() => {
    if (!selectedPreset) return
    const preset = SHORTCUT_PRESETS.find((p) => p.id === selectedPreset)
    if (!preset) return
    const layout = preset.getLayout()
    events.execute('ADD_LAYOUT', {
      name: preset.name,
      layout,
      icon: preset.icon,
      description: preset.description,
    })
    setShowAddShortcutModal(false)
    setSelectedPreset(null)
  }, [selectedPreset])

  const handleDeleteLayout = useCallback((id: string) => {
    events.execute('REMOVE_LAYOUT', id)
  }, [])

  // ── Add Skill modal ──────────────────────────────────────────────────
  const [showAddSkillModal, setShowAddSkillModal] = useState(false)
  const [showGitHubInput, setShowGitHubInput] = useState(false)
  const [gitHubUrl, setGitHubUrl] = useState('')
  const [gitHubDest, setGitHubDest] = useState(homedir())
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  const handleAddSkillLocalFolder = useCallback(async () => {
    const folder = await spellsMutations.pickSkillFolder()
    if (folder) {
      const newFolders = Array.from(
        new Set([...(data?.skills.folders || []), folder]),
      )
      await configMutations.set('skills', { folders: newFolders })
      reloadData()
    }
    setShowAddSkillModal(false)
  }, [data, reloadData])

  const handleAddSkillGitHub = useCallback(async () => {
    if (!gitHubUrl.trim()) return
    setInstalling(true)
    setInstallError(null)
    try {
      const result = await spellsMutations.installSkillFromGitHub(
        gitHubUrl.trim(),
        gitHubDest.trim() || homedir(),
      )
      if (result.success) {
        setShowGitHubInput(false)
        setShowAddSkillModal(false)
        setGitHubUrl('')
        setGitHubDest(homedir())
        reloadData()
      } else {
        setInstallError(result.error || 'Installation failed')
      }
    } catch (err: any) {
      setInstallError(err?.message || 'Installation failed')
    } finally {
      setInstalling(false)
    }
  }, [gitHubUrl, gitHubDest, reloadData])

  if (loading || !data) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  const {
    agents,
    folders,
    skills,
    sessions: rawSessions,
    messengers,
    activityCounts,
    messengerSessionCount,
    layouts,
    activeLayoutId,
  } = data
  const sessions = rawSessions
  const recentSessions = sessions.slice(0, 4)
  const sortedAgents = sortAgents(agents.list)

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[768px] mx-auto p-8 space-y-10">
          {/* ── Welcome ── */}
          <div className="text-center pt-4 pb-2">
            <AnimatedWelcome />
          </div>

          {/* ── Activity Histogram ── */}
          <ActivityHistogram activityCounts={activityCounts} />

          {/* ── Agents ── */}
          <Section title={t('agentsSection')} className="space-y-3">
            {sortedAgents.length > 0 ? (
              <div className="space-y-1">
                {sortedAgents.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    isDefault={agent.id === AYNITE_AGENT_ID}
                    activeId={agents.activeId}
                    messengers={messengers}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">
                {t('agentsNoData')}
              </p>
            )}
          </Section>

          {/* ── Recent Sessions ── */}
          <Section
            title={t('sessionsSection')}
            description={`You have worked with Aynite through ${sessions.length} desktop sessions and ${messengerSessionCount} messenger sessions`}
          >
            {sessions.length > 0 ? (
              <div className="space-y-6">
                <div className={GRID_2_COL}>
                  {recentSessions.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      onClick={() => handleSelectSession(s.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">
                {t('sessionsNoData')}
              </p>
            )}
          </Section>

          {/* ── Folders (Projects) ── */}
          <Section
            title={t('foldersSection')}
            description={t('foldersDescription')}
            action={
              folders.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddFolder}
                  className={ADD_ITEM_BUTTON}
                >
                  <Plus size={14} /> Add Folder
                </Button>
              ) : undefined
            }
          >
            {folders.length > 0 ? (
              <div className={GRID_2_COL}>
                {folders.map((folder) => (
                  <ProjectCard key={folder} folder={folder} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-md mx-auto">
                  I'd love to help, but I need to know what you're working on.
                  Please add a folder to your workspace so I can explore your
                  project and assist you better.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddFolder}
                  className="gap-2"
                >
                  <Plus size={14} />
                  Add Folder to Workspace
                </Button>
              </div>
            )}
          </Section>

          {/* ── Skills ── */}
          <Section
            title={t('skillsSection')}
            description={`${skills.items.length} ${t('skillsAvailable')}`}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddSkillModal(true)}
                className={ADD_ITEM_BUTTON}
              >
                <Plus size={14} /> Add Skills
              </Button>
            }
          >
            {skills.items.length > 0 && skills.folders.length > 0 ? (
              <div className={GRID_2_COL}>
                {skills.folders.map((f) => {
                  const count = skills.items.filter((item) =>
                    item.path.startsWith(f.replace(/\/?$/, '/')),
                  ).length
                  return (
                    <SkillFolderCard key={f} folder={f} skillCount={count} />
                  )
                })}
              </div>
            ) : skills.items.length > 0 ? (
              <p className="text-sm text-muted-foreground/50 italic">
                No skill folders configured.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">
                {t('skillsNoData')}
              </p>
            )}
          </Section>

          {/* ── Shortcuts ── */}
          <Section
            title={t('shortcutsSection')}
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPreset(null)
                  setShowAddShortcutModal(true)
                }}
                className={ADD_ITEM_BUTTON}
              >
                <Plus size={14} /> {t('shortcutsAdd')}
              </Button>
            }
          >
            {layouts.length > 0 ? (
              <ShortcutRow
                layouts={layouts}
                activeLayoutId={activeLayoutId}
                onSelect={(id) => events.execute('SWITCH_LAYOUT', id)}
                onDelete={handleDeleteLayout}
              />
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">
                {t('shortcutsNoData')}
              </p>
            )}
          </Section>

          {/* ── Add Skill Modal ── */}
          {showAddSkillModal && !showGitHubInput && (
            <Modal
              isOpen
              onClose={() => setShowAddSkillModal(false)}
              title="Add Skills"
              size="sm"
            >
              <div className="space-y-3 py-2">
                <button
                  type="button"
                  onClick={handleAddSkillLocalFolder}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-border/70 hover:bg-accent/10 transition-all text-left"
                >
                  <FolderIcon
                    size={18}
                    className="shrink-0 text-muted-foreground/50"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Select Local Folder
                    </div>
                    <div className="text-[11px] text-muted-foreground/50">
                      Choose a folder with skill files
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGitHubInput(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-border/70 hover:bg-accent/10 transition-all text-left"
                >
                  <Download
                    size={18}
                    className="shrink-0 text-muted-foreground/50"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Add from GitHub
                    </div>
                    <div className="text-[11px] text-muted-foreground/50">
                      Clone a skill repository
                    </div>
                  </div>
                </button>
              </div>
            </Modal>
          )}

          {/* ── Add Shortcut Modal ── */}
          {showAddShortcutModal && (
            <Modal
              isOpen
              onClose={() => {
                setShowAddShortcutModal(false)
                setSelectedPreset(null)
              }}
              title={t('shortcutsAddTitle')}
              size="md"
            >
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  {t('shortcutsAddDesc')}
                </p>

                {/* Preset list — scrollable row */}
                <div className="relative">
                  <div
                    ref={presetScrollRef}
                    className="flex gap-3 overflow-x-auto no-scrollbar pb-1"
                  >
                    {SHORTCUT_PRESETS.map((preset) => {
                      const PresetIcon =
                        SHORTCUT_ICON_MAP[preset.icon] || LayoutIcon
                      const isSelected = selectedPreset === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setSelectedPreset(isSelected ? null : preset.id)
                          }
                          className={cn(
                            'flex flex-col items-center gap-2 py-3 px-4 rounded-xl border transition-all shrink-0',
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-border/60 hover:bg-accent/5',
                          )}
                        >
                          <div
                            className={cn(
                              'flex items-center justify-center w-12 h-12 rounded-lg transition-all',
                              isSelected
                                ? 'bg-primary/10 text-primary'
                                : 'bg-accent/10 text-muted-foreground',
                            )}
                          >
                            <PresetIcon size={24} />
                          </div>
                          <span className="text-xs font-medium text-foreground whitespace-nowrap">
                            {preset.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Description */}
                {selectedPreset && (
                  <div className="rounded-lg bg-accent/5 border border-border p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {SHORTCUT_PRESETS.find((p) => p.id === selectedPreset)
                        ?.description || ''}
                    </p>
                  </div>
                )}

                {/* Limit reached message */}
                {layouts.length >= 10 && (
                  <div className="rounded-lg bg-warning/10 border border-warning/30 p-3">
                    <p className="text-xs text-foreground leading-relaxed">
                      You've reached the maximum of 10 shortcuts. Delete an
                      existing shortcut before adding a new one.
                    </p>
                  </div>
                )}

                {/* Add button */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setShowAddShortcutModal(false)
                      setSelectedPreset(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    disabled={!selectedPreset || layouts.length >= 10}
                    onClick={handleAddShortcut}
                  >
                    {t('shortcutsAddBtn')}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {/* ── GitHub URL Input Modal ── */}
          {showGitHubInput && (
            <Modal
              isOpen
              onClose={() => {
                setShowGitHubInput(false)
                setInstallError(null)
                setGitHubUrl('')
                setGitHubDest(homedir())
              }}
              title="Install from GitHub"
              size="sm"
              footer={
                <div className="flex gap-2 w-full">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setShowGitHubInput(false)
                      setInstallError(null)
                      setGitHubUrl('')
                      setGitHubDest(homedir())
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleAddSkillGitHub}
                    disabled={!gitHubUrl.trim() || installing}
                  >
                    {installing ? 'Installing...' : 'Install'}
                  </Button>
                </div>
              }
            >
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  GitHub repository URL:
                </p>
                <input
                  type="text"
                  value={gitHubUrl}
                  onChange={(e) => setGitHubUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full h-9 px-3 text-sm rounded-[6px] border border-border bg-background text-foreground outline-none focus:border-foreground/40 transition-colors"
                />
                <p className="text-sm text-muted-foreground">Download to:</p>
                <input
                  type="text"
                  value={gitHubDest}
                  onChange={(e) => setGitHubDest(e.target.value)}
                  placeholder="~"
                  className="w-full h-9 px-3 text-sm rounded-[6px] border border-border bg-background text-foreground outline-none focus:border-foreground/40 transition-colors font-mono"
                />
                {installError && (
                  <p className="text-xs text-destructive">{installError}</p>
                )}
              </div>
            </Modal>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────

// ── Agent Icon Map ──────────────────────────────────────────────────

const AGENT_ICONS: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  bot: BotIcon,
  brain: Brain,
  code: Code,
  compass: Compass,
  heart: Heart,
  star: Star,
  zap: Zap,
}

function getAgentIcon(iconId?: string) {
  if (iconId && AGENT_ICONS[iconId]) return AGENT_ICONS[iconId]
  return BotIcon
}

function ProjectCard({ folder }: { folder: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-accent/5 transition-all hover:border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <FolderIcon size={14} className="text-muted-foreground/60 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          {folder.split(/[/\\]/).pop() || folder}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/50 truncate font-mono">
        {folder}
      </p>
    </div>
  )
}

function AgentRow({
  agent,
  isDefault,
  activeId,
  messengers,
}: {
  agent: Agent
  isDefault: boolean
  activeId: string
  messengers: MessengerConfig[]
}) {
  const toolCount = countEnabledTools(agent)
  const isActive = agent.id === activeId
  const [showModal, setShowModal] = useState(false)
  const [editingMessenger, setEditingMessenger] =
    useState<MessengerConfig | null>(null)
  const modalMessenger = editingMessenger

  // Find all messengers bound to this agent
  const boundMessengers = messengers.filter((m) => m.agentId === agent.id)

  const AgentIcon = getAgentIcon(agent.icon)

  const handleOpenSettings = () => {
    events.execute('OPEN_AGENT_SETTINGS', { agentId: agent.id })
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingMessenger(null)
  }

  return (
    <div className="py-3">
      <div className="flex items-start gap-3">
        <AgentIcon
          size={16}
          className="mt-0.5 shrink-0 text-muted-foreground/60"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-medium text-foreground">
              {agent.name}
            </h3>
            {isDefault && (
              <span className="text-[10px] text-muted-foreground/50">
                Default
              </span>
            )}
            {isActive && !isDefault && (
              <span className="text-[10px] text-primary/70">Active</span>
            )}
          </div>

          {agent.introduction && (
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              {agent.introduction}
            </p>
          )}

          {/* Tool count + View details on the same row */}
          <div className="flex items-center gap-3 mt-1">
            {toolCount > 0 && (
              <span className="text-[10px] text-muted-foreground/40">
                Masters {toolCount} tool{toolCount === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              onClick={handleOpenSettings}
              className="text-[10px] font-medium text-primary/60 hover:text-primary bg-transparent border-none p-0 cursor-pointer"
            >
              View details
            </button>
          </div>

          {/* Messenger binding status */}
          {boundMessengers.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {boundMessengers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setEditingMessenger(m)
                    setShowModal(true)
                  }}
                  title="Edit messenger"
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium border cursor-pointer hover:bg-accent/20 transition-colors"
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      m.enabled && m.connected ? 'bg-green-500' : 'bg-red-400',
                    )}
                    title={
                      m.enabled && !m.connected
                        ? 'Failed to connect'
                        : !m.enabled
                          ? 'Disabled'
                          : undefined
                    }
                  />
                  <span
                    className={cn(
                      m.provider === 'telegram'
                        ? 'text-blue-400'
                        : 'text-indigo-400',
                    )}
                  >
                    {m.provider === 'telegram' ? 'Telegram' : 'Discord'}
                  </span>
                  {m.botName && (
                    <span className="text-muted-foreground">· {m.botName}</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-2">
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                No messenger is bound to this agent. Connecting a messenger bot
                allows you to interact with this agent from your phone via
                Telegram or Discord — extremely helpful for on-the-go access.
              </p>
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary/70 hover:text-primary bg-transparent border-none p-0 cursor-pointer transition-colors"
              >
                <MessageCircle size={12} />
                Connect a messenger bot
              </button>
            </div>
          )}
        </div>
      </div>

      <MessengerEditModal
        isOpen={showModal}
        onClose={handleModalClose}
        existing={modalMessenger}
        agentId={agent.id}
      />
    </div>
  )
}

function SkillFolderCard({
  folder,
  skillCount,
}: {
  folder: string
  skillCount: number
}) {
  return (
    <button
      type="button"
      onClick={() => events.execute('OPEN_SKILLS_SETTINGS')}
      className="w-full text-left p-4 rounded-xl border border-border bg-accent/5 transition-all hover:border-border/60 hover:bg-accent/10 cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <FolderIcon size={14} className="shrink-0 text-muted-foreground/40" />
        <span className="flex-1 text-xs font-mono text-foreground/80 truncate">
          {folder}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/30">
          {skillCount}
        </span>
      </div>
    </button>
  )
}

// ── Activity Histogram ─────────────────────────────────────────────────

function ActivityHistogram({
  activityCounts,
}: {
  activityCounts: Record<string, number>
}) {
  const { weeks, maxCount } = useMemo(
    () => buildFullYearGrid(activityCounts),
    [activityCounts],
  )

  const trailingMonths = useMemo(() => getTrailingMonths(), [])

  // Month label positions: figure out which week columns correspond to the 1st of a month
  const _monthMarkers = useMemo(() => {
    const markers: { label: string; col: number }[] = []
    // The grid starts 365 days ago, so figure out what dates each column represents
    // Each column is a week starting Sunday. Column i starts on day (i * 7) in the array.
    // The first day of the grid is: today - 364 days.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364)

    for (let col = 0; col < weeks.length; col++) {
      // The Wednesday of this week (middle-ish day) gives us a stable month anchor
      const wedDate = new Date(startDate)
      wedDate.setDate(wedDate.getDate() + col * 7 + 3)
      const month = wedDate.getMonth()
      // Check if the previous Wednesday was in a different month
      if (col > 0) {
        const prevWed = new Date(startDate)
        prevWed.setDate(prevWed.getDate() + (col - 1) * 7 + 3)
        if (prevWed.getMonth() !== month) {
          markers.push({ label: MONTH_NAMES[month], col })
        }
      } else {
        // Skip first marker — it's redundant since the grid starts there
      }
    }
    return markers
  }, [weeks])

  return (
    <div className="p-4 rounded-xl border border-border bg-accent/5">
      <div className="flex items-center gap-2 mb-4">
        <div className="size-2 rounded-full bg-primary/60" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Aynite Activity
        </span>
      </div>

      {/* Histogram: day labels on left, grid section on right.
          The grid section uses CSS grid with N equal columns (one per week). */}
      <div className="flex" style={{ gap: '4px' }}>
        {/* Day labels column — fixed 20px */}
        <div
          className="flex flex-col shrink-0"
          style={{ width: '20px', gap: '2px', paddingTop: '18px' }}
        >
          {DAY_LABELS.map((label) => (
            <div
              key={label || '.'}
              className="flex items-center"
              style={{
                height: '10px',
                fontSize: '8px',
                lineHeight: '10px',
              }}
            >
              <span className="text-muted-foreground/40">{label}</span>
            </div>
          ))}
        </div>

        {/* Right side: month labels, grid, legend share the same width */}
        <div
          className="flex flex-col"
          style={{ flex: '1', gap: '2px', minWidth: '0' }}
        >
          {/* Month labels — 12 equal columns, right-aligned text.
              Uses trailing months so the last column aligns with the current month. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(12, 1fr)`,
              height: '12px',
              fontSize: '8px',
            }}
          >
            {trailingMonths.map((m) => (
              <div
                key={m}
                className="flex items-end justify-end text-muted-foreground/40"
                style={{ lineHeight: '10px', paddingRight: '2px' }}
              >
                {m}
              </div>
            ))}
          </div>

          {/* Week grid — column-first layout, each column = one week */}
          <div
            style={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridTemplateRows: 'repeat(7, 10px)',
              gap: '2px',
            }}
          >
            {weeks.map((week, wi) =>
              week.map((bin, di) => (
                <div
                  key={bin.date || `empty-${wi}-${di}`}
                  style={{
                    aspectRatio: 1,
                    height: '10px',
                    borderRadius: '2px',
                  }}
                  className={cn(
                    bin.count > 0
                      ? 'border border-primary/10 dark:border-primary/20'
                      : 'border border-border/30',
                    getIntensityClass(bin.count, maxCount),
                  )}
                  title={
                    bin.date && bin.count > 0
                      ? `${bin.count} message${bin.count === 1 ? '' : 's'} on this day`
                      : undefined
                  }
                />
              )),
            )}
          </div>

          {/* Legend — right-aligned */}
          <div
            className="flex items-center justify-end"
            style={{ gap: '6px', marginTop: '8px' }}
          >
            <span
              style={{ fontSize: '8px' }}
              className="text-muted-foreground/40"
            >
              Less
            </span>
            {INTENSITY_COLORS.map((cls) => (
              <div
                key={cls}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                }}
                className={cls}
              />
            ))}
            <span
              style={{ fontSize: '8px' }}
              className="text-muted-foreground/40"
            >
              More
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shortcut Presets ──────────────────────────────────────────────────

interface ShortcutPreset {
  id: string
  name: string
  description: string
  icon: string
  getLayout: () => LayoutNode
}

const SHORTCUT_PRESETS: ShortcutPreset[] = [
  {
    id: 'coder-lite',
    name: 'Coder Lite',
    description:
      'A three-column layout with treeview, file browser, and AI chat — perfect for coding.',
    icon: 'code',
    getLayout: () => {
      const uid = () => Math.random().toString(36).slice(2, 10)
      return {
        id: `vibe-${uid()}`,
        type: 'split',
        direction: 'horizontal',
        size: 100,
        children: [
          { id: `leaf-${uid()}`, type: 'leaf', name: 'treeview', size: 20 },
          {
            id: `leaf-${uid()}`,
            type: 'leaf',
            name: 'file-browser',
            size: 50,
          },
          { id: `leaf-${uid()}`, type: 'leaf', name: 'aichat', size: 30 },
        ],
      }
    },
  },
  {
    id: 'reader',
    name: 'Reader',
    description:
      'A single-tile RSS reader view — keep up with your favorite feeds.',
    icon: 'rss',
    getLayout: () => {
      const uid = () => Math.random().toString(36).slice(2, 10)
      return {
        id: `leaf-${uid()}`,
        type: 'leaf',
        size: 100,
        name: 'rss',
      }
    },
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description:
      'An experimental integration for exploring possibilities for music discovery.',
    icon: 'spotify',
    getLayout: () => {
      const uid = () => Math.random().toString(36).slice(2, 10)
      return {
        id: `leaf-${uid()}`,
        type: 'leaf',
        size: 100,
        name: 'spotify',
      }
    },
  },
]

// ── Shared Layout Helpers ─────────────────────────────────────────────
// Default icons for system layouts (matching the sidebar icon map).

const SYSTEM_ICON_MAP: Record<string, typeof LayoutIcon> = {
  'sys-home': Home,
  'sys-projects': FolderOpen,
  'sys-settings': Settings,
}

// Ordered list matching the sidebar order: system items first (home, projects),
// then user-created layouts. Each entry includes the resolved icon component.

function getOrderedLayouts(
  layouts: LayoutEntry[],
): (LayoutEntry & { iconComponent: typeof LayoutIcon })[] {
  const systemOrder = ['sys-home', 'sys-projects', 'sys-settings']
  const systemLayouts: (LayoutEntry & { iconComponent: typeof LayoutIcon })[] =
    []
  const userLayouts: (LayoutEntry & { iconComponent: typeof LayoutIcon })[] = []

  for (const layout of layouts) {
    // Resolve icon: use system icon for known system layouts, otherwise use layout.icon
    const comp =
      layout.system && SYSTEM_ICON_MAP[layout.id]
        ? SYSTEM_ICON_MAP[layout.id]
        : layout.icon
          ? SHORTCUT_ICON_MAP[layout.icon] || LayoutIcon
          : LayoutIcon
    const entry = { ...layout, iconComponent: comp }
    if (layout.system && systemOrder.includes(layout.id)) {
      systemLayouts.push(entry)
    } else {
      userLayouts.push(entry)
    }
  }

  // Sort system layouts by sidebar order
  systemLayouts.sort(
    (a, b) => systemOrder.indexOf(a.id) - systemOrder.indexOf(b.id),
  )
  // Sort user layouts by name
  userLayouts.sort((a, b) => a.name.localeCompare(b.name))

  return [...systemLayouts, ...userLayouts]
}

// ── Shortcut Row ──────────────────────────────────────────────────────

function ShortcutRow({
  layouts,
  activeLayoutId,
  onSelect,
  onDelete,
}: {
  layouts: LayoutEntry[]
  activeLayoutId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState)
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState])

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = 120
    el.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  return (
    <div className="relative">
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy('left')}
          className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-sidebar border border-border shadow-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Scroll left"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            role="img"
            aria-label="Scroll left"
          >
            <path d="M6 2L3 5L6 8" />
          </svg>
        </button>
      )}

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar py-1"
      >
        {getOrderedLayouts(layouts).map((layout) => (
          <ShortcutItem
            key={layout.id}
            layout={layout}
            iconComponent={layout.iconComponent}
            isActive={layout.id === activeLayoutId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy('right')}
          className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-sidebar border border-border shadow-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Scroll right"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            role="img"
            aria-label="Scroll right"
          >
            <path d="M4 2L7 5L4 8" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Shortcut Item ──────────────────────────────────────────────────────

const SHORTCUT_ICON_MAP: Record<string, typeof LayoutIcon> = {
  code: Code,
  rss: Rss,
  spotify: Headphones,
}

function ShortcutItem({
  layout,
  iconComponent,
  onSelect,
  onDelete,
}: {
  layout: LayoutEntry
  iconComponent: typeof LayoutIcon
  isActive: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  const Icon = iconComponent

  return (
    <div className="relative shrink-0 group">
      <button
        type="button"
        onClick={() => onSelect(layout.id)}
        className={cn(
          'flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-accent/10',
        )}
        title={layout.description || layout.name}
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10">
          <Icon size={18} />
        </div>
        <span className="text-[9px] font-medium leading-tight text-center break-words max-w-[60px] text-muted-foreground">
          {layout.name}
        </span>
      </button>

      {/* Delete button — shown on group hover for non-system layouts */}
      {!layout.system && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(layout.id)
          }}
          className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm hover:opacity-80 transition-opacity opacity-0 group-hover:opacity-100"
          title="Remove shortcut"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  )
}

// ── Activity Histogram helpers ────────────────────────────────────────

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const _MONTH_NAMES_SHORT = MONTH_NAMES

// ── Flip animation keyframes ──────────────────────────────────────────

const FLIP_STYLES = `
@keyframes flip-top {
  0% { transform: rotateX(0deg); }
  49% { transform: rotateX(90deg); }
  50% { transform: rotateX(-90deg); }
  100% { transform: rotateX(0deg); }
}
@keyframes flip-bottom {
  0% { transform: rotateX(0deg); }
  49% { transform: rotateX(-90deg); }
  50% { transform: rotateX(90deg); }
  100% { transform: rotateX(0deg); }
}
@keyframes flip-left {
  0% { transform: rotateY(0deg); }
  49% { transform: rotateY(90deg); }
  50% { transform: rotateY(-90deg); }
  100% { transform: rotateY(0deg); }
}
@keyframes flip-right {
  0% { transform: rotateY(0deg); }
  49% { transform: rotateY(-90deg); }
  50% { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
}
`

// ── Word colors for flip animation ────────────────────────────────────

const WORD_COLORS = [
  'text-primary',
  'text-blue-500',
  'text-emerald-500',
  'text-amber-500',
  'text-violet-500',
  'text-rose-500',
  'text-cyan-500',
]

// ── Animated Word ──────────────────────────────────────────────────────

type FlipDir = 'top' | 'bottom' | 'left' | 'right'

const FLIP_DIRS: FlipDir[] = ['top', 'bottom', 'left', 'right']

/**
 * A single word that flips to a new random word at random intervals (1-3s).
 * Each flip uses a random direction and changes the word color.
 * The element reserves space for the longest word in the list.
 */
function AnimatedWord({
  words,
  initialIndex = 0,
}: {
  words: string[]
  initialIndex?: number
}) {
  const [index, setIndex] = useState(initialIndex)
  const [flipDir, setFlipDir] = useState<FlipDir>('top')
  const [color, setColor] = useState(WORD_COLORS[0])
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    const scheduleNext = () => {
      const delay = 1000 + Math.random() * 2000
      const _timer = setTimeout(() => {
        if (cancelled) return

        setFlipDir(FLIP_DIRS[Math.floor(Math.random() * FLIP_DIRS.length)])
        setAnimKey((k) => k + 1)

        setTimeout(() => {
          if (cancelled) return
          setIndex((prev) => {
            let next: number
            do {
              next = Math.floor(Math.random() * words.length)
            } while (next === prev)
            return next
          })
          setColor(WORD_COLORS[Math.floor(Math.random() * WORD_COLORS.length)])
        }, 150)

        scheduleNext()
      }, delay)
    }

    scheduleNext()
    return () => {
      cancelled = true
    }
  }, [words])

  const minWidth = useMemo(() => {
    const longest = words.reduce((a, b) => (a.length > b.length ? a : b), '')
    return `${longest.length + 1}ch`
  }, [words])

  return (
    <span
      key={animKey}
      className={cn('inline-block text-center font-semibold', color)}
      style={{
        minWidth,
        animation: `flip-${flipDir} 0.3s ease-in-out`,
      }}
    >
      {words[index]}
    </span>
  )
}

// ── Word lists ─────────────────────────────────────────────────────────

const ACTION_WORDS = [
  'Hack',
  'Build',
  'Create',
  'Code',
  'Ship',
  'Craft',
  'Forge',
  'Design',
  'Make',
  'Shape',
]

const BREAK_WORDS = [
  'Have fun',
  'Coffee',
  'Pizza',
  'Beer',
  'Tea',
  'Nap',
  'Stretch',
  'Walk',
  'Chill',
  'Snack',
]

// ── Animated Welcome ───────────────────────────────────────────────────

function AnimatedWelcome() {
  return (
    <>
      <style>{FLIP_STYLES}</style>
      <img src={appIcon} alt="Aynite" className="w-12 h-12 mx-auto mb-3" />
      <h2 className="text-2xl font-bold text-foreground mb-3">Aynite</h2>
      <p className="text-lg font-semibold tracking-wide">
        <AnimatedWord words={ACTION_WORDS} initialIndex={0} />
        <span className="text-muted-foreground/40 mx-2">·</span>
        <AnimatedWord words={BREAK_WORDS} initialIndex={0} />
        <span className="text-muted-foreground/40 mx-2">·</span>
        <span className="text-muted-foreground/60 font-semibold">Repeat</span>
      </p>
    </>
  )
}

/** Return the 12-month labels ending at the current month. */
function getTrailingMonths(): string[] {
  const now = new Date()
  const currentMonth = now.getMonth()
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const m = (currentMonth - 11 + i + 12) % 12
    months.push(MONTH_NAMES[m])
  }
  return months
}
