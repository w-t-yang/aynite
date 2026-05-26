import { Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../../../shared/basic/Button'
import { cn } from '../../../shared/lib/utils'
import type { RssItem } from '../types'

interface ArticleDetailProps {
  item: RssItem | null
  isBookmarked: boolean
  onToggleBookmark: () => void
  onOpenExternal: (url: string) => void
}

export function ArticleDetail({
  item,
  isBookmarked,
  onToggleBookmark,
  onOpenExternal,
}: ArticleDetailProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const openExternalRef = useRef(onOpenExternal)
  openExternalRef.current = onOpenExternal

  // Capture link clicks at the document level with capture phase,
  // but only intercept clicks inside the content div
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Only intercept if click is inside our content area
      const contentEl = contentRef.current
      if (!contentEl?.contains(target)) return

      const link = target.closest('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href) return
      if (href.startsWith('http://') || href.startsWith('https://')) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        openExternalRef.current(href)
      }
    }
    // Use capture phase at document level for earliest possible interception
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [])

  // Override window.open to catch any target="_blank" navigations
  useEffect(() => {
    const originalOpen = window.open
    window.open = (
      url?: string | URL,
      _target?: string,
      _features?: string,
    ) => {
      if (url) {
        const urlStr = typeof url === 'string' ? url : url.toString()
        if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) {
          openExternalRef.current(urlStr)
        }
      }
      return null
    }
    return () => {
      window.open = originalOpen
    }
  }, [])

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-w-[320px] p-8 text-center">
        <ExternalLink size={36} className="text-muted-foreground/20 mb-4" />
        <p className="text-sm text-muted-foreground/50">
          Select an article to read
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-[320px] bg-card">
      {/* Article content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto p-6">
          {/* Title */}
          <h1 className="text-xl font-bold text-foreground leading-tight mb-3">
            {item.title}
          </h1>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-muted-foreground">
            {item.author && (
              <>
                <span>{item.author}</span>
                <span className="text-muted-foreground/30">·</span>
              </>
            )}
            <span>
              {new Date(item.pubDate).toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {item.feedTitle && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span>{item.feedTitle}</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenExternal(item.link)}
              className="gap-1.5"
            >
              <ExternalLink size={14} />
              Open in Browser
            </Button>
            <Button
              variant={isBookmarked ? 'primary' : 'ghost'}
              size="sm"
              onClick={onToggleBookmark}
              className={cn(
                'gap-1.5',
                isBookmarked && 'text-primary-foreground',
              )}
            >
              {isBookmarked ? (
                <BookmarkCheck size={14} />
              ) : (
                <Bookmark size={14} />
              )}
              {isBookmarked ? 'Saved' : 'Save'}
            </Button>
          </div>

          {/* Categories */}
          {item.categories && item.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {item.categories.map((cat) => (
                <span
                  key={cat}
                  className="px-2 py-0.5 text-[10px] rounded-full bg-accent text-muted-foreground"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border/40 mb-6" />

          {/* Content */}
          {item.content ? (
            <div
              ref={contentRef}
              className="prose prose-sm max-w-none"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: RSS content from trusted feeds
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No content available.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
