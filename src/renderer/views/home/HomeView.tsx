import {
  Bot,
  Folder as FolderIcon,
  Home,
  MessageSquare,
  Plus,
  Puzzle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ADD_ITEM_BUTTON,
  GRID_2_COL,
} from '../../../lib/constants/renderer/styles'
import type { Agent } from '../../../lib/types/ai'
import { ai } from '../../bridge/ai'
import { config } from '../../bridge/config'
import { spells } from '../../bridge/spells'
import { workspace, workspaceMutations } from '../../bridge/workspace'
import { Button } from '../../shared/basic/Button'
import { Section } from '../../shared/basic/Section'
import { ViewHeader } from '../../shared/basic/ViewHeader'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { cn } from '../../shared/lib/utils'
import { useAppEventSubscriber, useView } from '../ViewContext'
import viewConfig from './config.json'

interface SkillEntry {
  name: string
  description: string
  path: string
  error?: string
}

interface SessionEntry {
  id: string
  date: string
  lastModified: string
  title: string
  preview: string
  messageCount: number
}

type DashboardData = {
  agents: { list: Agent[]; activeId: string }
  folders: string[]
  skills: { folders: string[]; items: SkillEntry[] }
  sessions: SessionEntry[]
}

// ── Activity histogram helpers ─────────────────────────────────────────

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

/**
 * Generate a full 365-day grid ending at today.
 * Returns 53 weeks, each with 7 DayBin (Sun=index 0, Sat=index 6).
 * Every day has a count (0 means no activity).
 * The grid is oldest→newest left→right.
 */
function buildFullYearGrid(sessions: SessionEntry[]) {
  // Count map: match session dates to local dates by parsing local date strings
  const countMap = new Map<string, number>()
  let maxCount = 0
  for (const s of sessions) {
    const prev = countMap.get(s.date) || 0
    countMap.set(s.date, prev + s.messageCount)
    maxCount = Math.max(maxCount, prev + s.messageCount)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days: { date: string; count: number }[] = []

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    // Format date as YYYY-MM-DD in local timezone (matches how the user sees dates)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${day}`
    days.push({
      date: dateStr,
      count: countMap.get(dateStr) || 0,
    })
  }

  // Pad start to align first day with Sunday (row 0)
  // Parse the date parts back to get the correct day-of-week
  const [y0, m0, d0] = days[0].date.split('-').map(Number)
  const firstDate = new Date(y0, m0 - 1, d0)
  const firstDayOfWeek = firstDate.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.unshift({ date: '', count: 0 })
  }

  // Group into weeks (Sunday first = index 0)
  const weeks: { date: string; count: number }[][] = []
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
      const [agentsRaw, foldersRaw, skillsRaw, skillsCfg, sessionsRaw] =
        await Promise.all([
          config.get('agents'),
          workspace.folders(),
          spells.getAvailableSkills(),
          config.get('skills'),
          ai.listSessions(),
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
    const [agentsRaw, foldersRaw, skillsRaw, skillsCfg, sessionsRaw] =
      await Promise.all([
        config.get('agents'),
        workspace.folders(),
        spells.getAvailableSkills(),
        config.get('skills'),
        ai.listSessions(),
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
    })
  }, [])

  useEffect(() => {
    const unsub = subscribeToAppEvents((event: any) => {
      if (event.type === 'workspace-changed') reloadData()
      if (event.type === 'config-changed') reloadData()
    })
    return () => unsub()
  }, [subscribeToAppEvents, reloadData])

  if (loading || !data) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <ViewHeader icon={<Home size={16} />} title={t('title')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <div className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  const { agents, folders, skills, sessions } = data
  const recentSessions = sessions.slice(0, 4)

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader icon={<Home size={16} />} title={t('title')} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-10">
          {/* ── Welcome ── */}
          <div className="text-center pt-4 pb-2">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {t('welcome')}
            </h2>
            <p className="text-sm text-muted-foreground/70 max-w-lg mx-auto leading-relaxed">
              {t('description')}
            </p>
          </div>

          {/* ── Recent Sessions ── */}
          <Section
            title={t('sessionsSection')}
            description={`Your ${sessions.length} past conversations`}
          >
            {sessions.length > 0 ? (
              <div className="space-y-6">
                <ActivityHistogram sessions={sessions} />
                <div className={GRID_2_COL}>
                  {recentSessions.map((s) => (
                    <SessionCard key={s.id} session={s} />
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

          {/* ── Agents ── */}
          <Section
            title={t('agentsSection')}
            description={t('agentsDescription')}
          >
            {agents.list.length > 0 ? (
              <div className={GRID_2_COL}>
                {agents.list.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isActive={agent.id === agents.activeId}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">
                {t('agentsNoData')}
              </p>
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

function AgentCard({ agent, isActive }: { agent: Agent; isActive: boolean }) {
  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        isActive
          ? 'border-primary bg-primary/[0.03]'
          : 'border-border bg-accent/5 hover:border-border/60',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Bot size={14} className="text-primary shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          {agent.name}
        </span>
        {isActive && (
          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-auto">
            Active
          </span>
        )}
      </div>
      {agent.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
          {agent.description}
        </p>
      )}
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

/** Get a human-readable title for a session card.
 *  Uses the metadata title if available, otherwise falls back to the
 *  first user message (preview). */
function getSessionDisplayTitle(session: SessionEntry): string {
  // The server returns "Session XXXXXX" as fallback when no metadata title exists
  if (session.title && !session.title.startsWith('Session ')) {
    return session.title
  }
  return session.preview || 'Untitled'
}

function SessionCard({ session }: { session: SessionEntry }) {
  const dateLabel = useMemo(() => {
    const d = new Date(session.lastModified)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }, [session.lastModified])

  const displayTitle = useMemo(() => getSessionDisplayTitle(session), [session])

  return (
    <div className="p-4 rounded-xl border border-border bg-accent/5 transition-all hover:border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare
          size={14}
          className="text-muted-foreground/60 shrink-0"
        />
        <span className="text-xs font-bold uppercase tracking-wider truncate">
          {displayTitle}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
        {session.preview}
      </p>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
        <span>{dateLabel}</span>
        <span>{session.messageCount} messages</span>
      </div>
    </div>
  )
}

// ── Activity Histogram ─────────────────────────────────────────────────

function ActivityHistogram({ sessions }: { sessions: SessionEntry[] }) {
  const { weeks, maxCount } = useMemo(
    () => buildFullYearGrid(sessions),
    [sessions],
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
          Session Activity
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
                    width: '100%',
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
                    bin.date ? `${bin.date}: ${bin.count} messages` : undefined
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
