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
import { GRID_2_COL } from '../../../lib/constants/renderer/styles'
import type { Agent, MessengerConfig } from '../../../lib/types/ai'
import { ai } from '../../bridge/ai'
import { config } from '../../bridge/config'
import { events } from '../../bridge/events'
import { spells } from '../../bridge/spells'
import { workspace, workspaceMutations } from '../../bridge/workspace'
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
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <div className="size-3 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
            <span className="text-sm">Loading...</span>
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
        <div className="max-w-[640px] mx-auto px-6 py-10 space-y-14">
          {/* ── Welcome ── */}
          <header className="text-center pt-6 pb-2">
            <img
              src={appIcon}
              alt="Aynite"
              className="w-10 h-10 mx-auto mb-4 opacity-80"
            />
            <h1 className="text-[28px] font-semibold tracking-tight text-foreground mb-1.5">
              Welcome to Aynite
            </h1>
            <p className="text-base font-medium text-muted-foreground/60">
              <AnimatedWord words={ACTION_WORDS} initialIndex={0} />
              <span className="mx-2 text-muted-foreground/20">·</span>
              <AnimatedWord words={BREAK_WORDS} initialIndex={0} />
              <span className="mx-2 text-muted-foreground/20">·</span>
              <span className="text-muted-foreground/40">Repeat</span>
            </p>
          </header>

          {/* ── Agents ── */}
          <section>
            <SectionHeader title={t('agentsSection')} />
            <div className="mt-4 space-y-px bg-accent/5 rounded-[10px] border border-border/50 divide-y divide-border/20">
              {sortedAgents.length > 0 ? (
                sortedAgents.map((agent) => (
                  <AgentRow
                    key={agent.id}
                    agent={agent}
                    isDefault={agent.id === AYNITE_AGENT_ID}
                    activeId={agents.activeId}
                    messengers={messengers}
                  />
                ))
              ) : (
                <div className="px-5 py-6 text-sm text-muted-foreground/50 italic text-center">
                  {t('agentsNoData')}
                </div>
              )}
            </div>
          </section>

          {/* ── Recent Sessions ── */}
          <section>
            <SectionHeader
              title={t('sessionsSection')}
              subtitle={`${sessions.length} session${sessions.length === 1 ? '' : 's'} total`}
            />
            {sessions.length > 0 ? (
              <div className="mt-4 space-y-5">
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
              <div className="mt-4 text-sm text-muted-foreground/50 italic">
                {t('sessionsNoData')}
              </div>
            )}
          </section>

          {/* ── Folders (Projects) ── */}
          <section>
            <SectionHeader
              title={t('foldersSection')}
              subtitle={t('foldersDescription')}
              action={
                folders.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleAddFolder}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-[6px] border border-border/60 text-muted-foreground/70 hover:text-foreground hover:border-foreground/30 transition-all bg-transparent"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                ) : undefined
              }
            />
            {folders.length > 0 ? (
              <div className="mt-4 space-y-1">
                {folders.map((folder) => (
                  <ProjectCard key={folder} folder={folder} />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[10px] border border-dashed border-border/40 p-8 text-center">
                <p className="text-sm text-muted-foreground/60 leading-relaxed max-w-sm mx-auto mb-4">
                  Add a folder to your workspace so I can explore your project
                  and assist you better.
                </p>
                <button
                  type="button"
                  onClick={handleAddFolder}
                  className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-[6px] bg-foreground text-background hover:opacity-90 transition-opacity"
                >
                  <Plus size={14} />
                  Add Folder to Workspace
                </button>
              </div>
            )}
          </section>

          {/* ── Skills ── */}
          <section>
            <SectionHeader
              title={t('skillsSection')}
              subtitle={t('skillsDescription')}
            />
            {skills.items.length > 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground/50">
                  {skills.items.length} skill(s) installed
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
              <div className="mt-4 text-sm text-muted-foreground/50 italic">
                {t('skillsNoData')}
              </div>
            )}
          </section>

          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}

// ── Section Header ───────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-0.5">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/50">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

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
  const name = folder.split(/[/\\]/).pop() || folder
  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 rounded-[8px] border border-border/40 hover:border-border/70 hover:bg-accent/5 transition-all cursor-default">
      <FolderIcon
        size={14}
        className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
          {name}
        </span>
        <p className="text-[11px] text-muted-foreground/40 font-mono truncate mt-0.5">
          {folder}
        </p>
      </div>
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
    <div className="px-5 py-4">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 shrink-0 text-muted-foreground/40">
          <AgentIcon size={15} />
        </span>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">
              {agent.name}
            </h3>
            {isDefault && (
              <span className="text-[10px] font-medium text-muted-foreground/40 px-1.5 py-0.5 rounded-[4px] border border-border/40">
                Default
              </span>
            )}
            {isActive && !isDefault && (
              <span className="text-[10px] font-medium text-foreground/60 px-1.5 py-0.5 rounded-[4px] bg-accent/20">
                Active
              </span>
            )}
          </div>

          {agent.introduction && (
            <p className="text-[12px] text-muted-foreground/60 leading-relaxed">
              {agent.introduction}
            </p>
          )}

          <div className="flex items-center gap-3">
            {toolCount > 0 && (
              <span className="text-[11px] text-muted-foreground/40">
                {toolCount} tool{toolCount === 1 ? '' : 's'}
              </span>
            )}
            <button
              type="button"
              onClick={handleOpenSettings}
              className="text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors bg-transparent border-none p-0 cursor-pointer"
            >
              Settings
            </button>
          </div>

          {boundMessengers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {boundMessengers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setEditingMessenger(m)
                    setShowModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 h-6 px-2 rounded-[6px] text-[10px] font-medium border border-border/40 hover:border-border/70 hover:bg-accent/10 transition-all cursor-pointer bg-transparent"
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      m.enabled && m.connected ? 'bg-green-500' : 'bg-red-400',
                    )}
                  />
                  <span
                    className={cn(
                      m.provider === 'telegram'
                        ? 'text-blue-500'
                        : 'text-indigo-500',
                    )}
                  >
                    {m.provider === 'telegram' ? 'Telegram' : 'Discord'}
                  </span>
                  {m.botName && (
                    <span className="text-muted-foreground/50">
                      · {m.botName}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors bg-transparent border-none p-0 cursor-pointer"
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
  const name = folder.split(/[/\\]/).pop() || folder
  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 rounded-[8px] border border-border/40 hover:border-border/70 hover:bg-accent/5 transition-all cursor-default">
      <Puzzle
        size={14}
        className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors"
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
          {name}
        </span>
        <p className="text-[11px] text-muted-foreground/40 font-mono truncate mt-0.5">
          {folder}
        </p>
      </div>
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
    <div className="p-4 rounded-[10px] border border-border/40 bg-accent/3">
      <div className="flex items-center gap-2 mb-4">
        <div className="size-1.5 rounded-full bg-foreground/30" />
        <span className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground/60">
          Message Activity
        </span>
      </div>

      <div className="flex" style={{ gap: '4px' }}>
        <div
          className="flex flex-col shrink-0"
          style={{ width: '20px', gap: '2px', paddingTop: '18px' }}
        >
          {DAY_LABELS.map((label) => (
            <div
              key={label || '.'}
              className="flex items-center"
              style={{ height: '10px', fontSize: '8px', lineHeight: '10px' }}
            >
              <span className="text-muted-foreground/30">{label}</span>
            </div>
          ))}
        </div>

        <div
          className="flex flex-col"
          style={{ flex: '1', gap: '2px', minWidth: '0' }}
        >
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
                className="flex items-end justify-end text-muted-foreground/30"
                style={{ lineHeight: '10px', paddingRight: '2px' }}
              >
                {m}
              </div>
            ))}
          </div>

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
                      : 'border border-border/20',
                    getIntensityClass(bin.count, maxCount),
                  )}
                  title={
                    bin.date && bin.count > 0
                      ? `${bin.count} message${bin.count === 1 ? '' : 's'}`
                      : undefined
                  }
                />
              )),
            )}
          </div>

          <div
            className="flex items-center justify-end"
            style={{ gap: '6px', marginTop: '8px' }}
          >
            <span
              style={{ fontSize: '8px' }}
              className="text-muted-foreground/30"
            >
              Less
            </span>
            {INTENSITY_COLORS.map((cls) => (
              <div
                key={cls}
                style={{ width: '10px', height: '10px', borderRadius: '2px' }}
                className={cls}
              />
            ))}
            <span
              style={{ fontSize: '8px' }}
              className="text-muted-foreground/30"
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

const _FLIP_STYLES = `
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
      className="inline-block text-center font-semibold text-foreground/80"
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
