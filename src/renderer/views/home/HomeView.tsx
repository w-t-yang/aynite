import {
  Bot as BotIcon,
  Brain,
  Code,
  Compass,
  Folder as FolderIcon,
  Heart,
  MessageCircle,
  Plus,
  Puzzle,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import appIcon from '../../../../build/icon-64.png'
import {
  ADD_ITEM_BUTTON,
  GRID_2_COL,
} from '../../../lib/constants/renderer/styles'
import type { Agent, MessengerConfig } from '../../../lib/types/ai'
import { ai } from '../../bridge/ai'
import { config } from '../../bridge/config'
import { events } from '../../bridge/events'
import { spells } from '../../bridge/spells'
import { workspace, workspaceMutations } from '../../bridge/workspace'
import { Button } from '../../shared/basic/Button'
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

type DashboardData = {
  agents: { list: Agent[]; activeId: string }
  folders: string[]
  skills: { folders: string[]; items: SkillEntry[] }
  sessions: SessionEntry[]
  messengers: MessengerConfig[]
  activityCounts: Record<string, number>
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
      ] = await Promise.all([
        config.get('agents'),
        workspace.folders(),
        spells.getAvailableSkills(),
        config.get('skills'),
        ai.listSessions(),
        config.get('messengers'),
        ai.getActivityCounts(),
      ])
      if (cancelled) return
      const agentsData = agentsRaw as { activeId: string; list: Agent[] } | null
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
    ] = await Promise.all([
      config.get('agents'),
      workspace.folders(),
      spells.getAvailableSkills(),
      config.get('skills'),
      ai.listSessions(),
      config.get('messengers'),
      ai.getActivityCounts(),
    ])
    const agentsData = agentsRaw as { activeId: string; list: Agent[] } | null
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
    // Update in-memory config + switch to projects layout atomically
    events.execute('OPEN_SESSION', { sessionId })
  }, [])

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
            description={`You have worked with Aynite through ${sessions.length} sessions`}
          >
            {sessions.length > 0 ? (
              <div className="space-y-6">
                <ActivityHistogram activityCounts={activityCounts} />
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
            description={t('skillsDescription')}
          >
            {skills.items.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {skills.items.length} skill(s) are installed.
                </p>
                {skills.folders.length > 0 && (
                  <div className={GRID_2_COL}>
                    {skills.folders.map((f) => (
                      <SkillFolderCard key={f} folder={f} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">
                {t('skillsNoData')}
              </p>
            )}
          </Section>
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

function SkillFolderCard({ folder }: { folder: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-accent/5 transition-all hover:border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <Puzzle size={14} className="text-muted-foreground/60 shrink-0" />
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
          Message Activity
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

// ── Animated Word ──────────────────────────────────────────────────────

type FlipDir = 'top' | 'bottom' | 'left' | 'right'

const FLIP_DIRS: FlipDir[] = ['top', 'bottom', 'left', 'right']

/**
 * A single word that flips to a new random word at random intervals (1-3s).
 * Each flip uses a random direction (top/bottom/left/right).
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
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    const scheduleNext = () => {
      const delay = 1000 + Math.random() * 2000
      const _timer = setTimeout(() => {
        if (cancelled) return

        // Pick random flip direction
        setFlipDir(FLIP_DIRS[Math.floor(Math.random() * FLIP_DIRS.length)])
        // Restart animation by incrementing key
        setAnimKey((k) => k + 1)

        // Mid-animation (150ms): swap the word for the flip-in phase
        setTimeout(() => {
          if (cancelled) return
          setIndex((prev) => {
            let next: number
            do {
              next = Math.floor(Math.random() * words.length)
            } while (next === prev)
            return next
          })
        }, 150)

        // Schedule the next cycle
        scheduleNext()
      }, delay)
    }

    scheduleNext()
    return () => {
      cancelled = true
    }
  }, [words])

  // Compute the widest word to reserve space
  const minWidth = useMemo(() => {
    const longest = words.reduce((a, b) => (a.length > b.length ? a : b), '')
    return `${longest.length + 1}ch`
  }, [words])

  return (
    <span
      key={animKey}
      className="inline-block text-center font-semibold text-primary/90"
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
      <h2 className="text-2xl font-bold text-foreground mb-3">
        Welcome to Aynite
      </h2>
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
