import { Bookmark, CheckCheck, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '../../../shared/lib/utils'
import type { RssItem } from '../types'

interface ArticleListProps {
  items: RssItem[]
  bookmarks: Record<string, any>
  selectedItemId: string | null
  sourceTitle?: string
  loading: boolean
  width?: number
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

export function ArticleList({
  items,
  bookmarks,
  selectedItemId,
  sourceTitle,
  loading,
  width,
  onSelectItem,
  onMarkAllRead,
  onOpenExternal: _onOpenExternal,
}: ArticleListProps) {
  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-w-[280px]"
        style={width ? { width, flex: 'none' } : { flex: 1 }}
      >
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
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
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {items.map((item) => {
          const isSelected = selectedItemId === item.id
          const isBookmarked = !!bookmarks[item.id]
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: clickable list item, consistent with other views
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-2 px-4 py-2.5 cursor-pointer border-b border-border/20 transition-colors group',
                isSelected ? 'bg-accent' : 'hover:bg-accent/30',
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
                  {item.author && (
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
        })}
      </div>
    </div>
  )
}
