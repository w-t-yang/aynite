import { Bookmark, CheckCheck, ExternalLink, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { cn } from '../../../shared/lib/utils'
import type { RssItem } from '../types'

interface ArticleListProps {
  items: RssItem[]
  bookmarks: Record<string, any>
  selectedItemId: string | null
  sourceTitle?: string
  loading: boolean
  width?: number
  groupByDate?: boolean
  showSourceBadge?: boolean
  focusColumn: number
  focusRow: number
  onSelectItem: (itemId: string) => void
  onMarkAllRead: () => void
  onOpenExternal: (url: string) => void
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHrs < 24) return `${diffHrs}h`
  if (diffDays < 7) return `${diffDays}d`
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

type DateGroup = { label: string; items: RssItem[] }

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const d = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime()
  const t = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime()
  const y = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
  ).getTime()

  if (d === t) return 'Today'
  if (d === y) return 'Yesterday'
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function groupItemsByDate(items: RssItem[]): DateGroup[] {
  const groups = new Map<string, RssItem[]>()
  for (const item of items) {
    const label = getDateLabel(item.pubDate)
    const list = groups.get(label) || []
    list.push(item)
    groups.set(label, list)
  }
  const ordered = Array.from(groups.entries())
  // Sort groups by the actual date of their first item (descending)
  ordered.sort((a, b) => {
    const dateA = new Date(a[1][0].pubDate).getTime()
    const dateB = new Date(b[1][0].pubDate).getTime()
    return dateB - dateA
  })
  return ordered.map(([label, groupItems]) => ({ label, items: groupItems }))
}

export function ArticleList({
  items,
  bookmarks,
  selectedItemId,
  sourceTitle,
  loading,
  width,
  groupByDate = false,
  showSourceBadge = false,
  focusColumn,
  focusRow,
  onSelectItem,
  onMarkAllRead,
  onOpenExternal: _onOpenExternal,
}: ArticleListProps) {
  const dateGroups = useMemo(
    () => (groupByDate ? groupItemsByDate(items) : null),
    [items, groupByDate],
  )

  // Scroll focused item into view
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusColumn === 1 && scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-focused="true"]')
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusColumn])

  if (loading) {
    return (
      <div
        className="flex flex-col min-w-[280px] border-r border-border"
        style={width ? { width, flex: 'none' } : { flex: 1 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground">
            {sourceTitle || 'All Articles'}
          </span>
        </div>
        {/* Spinner */}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-w-[280px] p-8 text-center"
        style={width ? { width, flex: 'none' } : { flex: 1 }}
      >
        <ExternalLink size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No articles yet</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Add a feed source to get started.
        </p>
      </div>
    )
  }

  const renderItem = (item: RssItem, index: number) => {
    const isSelected = selectedItemId === item.id
    const isBookmarked = !!bookmarks[item.id]
    const isFocused = focusColumn === 1 && focusRow === index
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: clickable list item, consistent with other views
      <div
        key={item.id}
        data-focused={isFocused && !isSelected ? 'true' : undefined}
        className={cn(
          'flex items-start gap-2 px-4 py-2.5 cursor-pointer border-b border-border/20 transition-colors group',
          isSelected ? 'bg-accent' : 'hover:bg-accent/30',
          isFocused &&
            !isSelected &&
            'bg-primary/[0.04] border-l-2 border-primary/50 pl-[14px]',
        )}
        onClick={() => onSelectItem(item.id)}
        onKeyDown={() => {}}
      >
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm leading-snug mb-0.5 line-clamp-2',
              !item.isRead
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground',
            )}
          >
            {item.title}
          </div>
          {item.contentSnippet && (
            <p className="text-xs text-muted-foreground/60 line-clamp-1 mt-0.5">
              {item.contentSnippet}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground/40">
              {formatRelativeTime(item.pubDate)}
            </span>
            {showSourceBadge && item.feedTitle && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium leading-none">
                {item.feedTitle}
              </span>
            )}
            {item.author && !showSourceBadge && (
              <span className="text-[10px] text-muted-foreground/40 truncate">
                {item.author}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          {isBookmarked && (
            <Bookmark size={10} className="text-primary fill-primary" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col min-w-[280px] border-r border-border"
      style={width ? { width, flex: 'none' } : { flex: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20 shrink-0">
        <span className="text-xs font-semibold text-muted-foreground">
          {sourceTitle || 'All Articles'} ({items.length})
        </span>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Mark all as read"
        >
          <CheckCheck size={12} />
          Mark all read
        </button>
      </div>

      {/* Article list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {dateGroups
          ? dateGroups.map((group) => (
              <div key={group.label}>
                <div className="sticky top-0 z-10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 backdrop-blur-sm border-b border-border/10">
                  {group.label}
                </div>
                {group.items.map((item, idx) => renderItem(item, idx))}
              </div>
            ))
          : items.map((item, idx) => renderItem(item, idx))}
      </div>
    </div>
  )
}
