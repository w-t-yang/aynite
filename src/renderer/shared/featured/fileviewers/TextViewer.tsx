import { useEffect, useMemo, useRef } from 'react'
import type { FileInfo } from '../../../../lib/types/files'
import {
  getSearchMatchLine,
  highlightCode,
  highlightWithSearch,
} from '../../lib/syntax'
import { cn } from '../../lib/utils'

interface TextViewerProps {
  content: string
  file?: FileInfo
  extension?: string
  className?: string
  showLineNumbers?: boolean
  /** Search query for highlighting matches */
  searchQuery?: string
  /** Index of the active (current) search match */
  activeMatchIndex?: number
  /** Called with total match count whenever search highlights are computed */
  onSearchResult?: (total: number) => void
}

/**
 * TextViewer provides a high-performance, read-only text display with syntax highlighting.
 * It is designed for simplicity and stability in non-editing views.
 */
export function TextViewer({
  content,
  file,
  extension,
  className,
  showLineNumbers = true,
  searchQuery,
  activeMatchIndex,
  onSearchResult,
}: TextViewerProps) {
  const effectiveExtension = extension || file?.extension || 'txt'
  const scrollRef = useRef<HTMLDivElement>(null)

  const highlightedHtml = useMemo(() => {
    return searchQuery
      ? highlightWithSearch(
          content,
          effectiveExtension,
          searchQuery,
          activeMatchIndex,
        )
      : highlightCode(content, effectiveExtension)
  }, [content, effectiveExtension, searchQuery, activeMatchIndex])

  const lines = useMemo(() => content.split('\n'), [content])

  // Track match count
  const totalMatches = useMemo(() => {
    if (!searchQuery) return 0
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const matches = content.match(regex)
    return matches?.length ?? 0
  }, [content, searchQuery])

  // Report match count
  useEffect(() => {
    onSearchResult?.(totalMatches)
  }, [totalMatches, onSearchResult])

  // Scroll to the active match
  useEffect(() => {
    if (!searchQuery || !scrollRef.current) return
    const line = getSearchMatchLine(content, searchQuery, activeMatchIndex ?? 0)
    if (line === null) return
    const lineHeight = 24 // matches leading-relaxed
    const _padding = 16
    scrollRef.current.scrollTop =
      line * lineHeight - scrollRef.current.clientHeight / 3
  }, [content, searchQuery, activeMatchIndex])

  return (
    <div
      className={cn(
        'flex h-full w-full bg-background font-mono text-sm overflow-hidden',
        className,
      )}
    >
      {showLineNumbers && (
        <div className="w-12 shrink-0 bg-sidebar border-r border-border text-right pr-2 py-4 text-muted-foreground opacity-40 overflow-hidden select-none">
          {lines.map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Line numbers are stable and don't change identity
            <div key={i + 1} className="leading-relaxed h-6">
              {i + 1}
            </div>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4">
        <pre
          className="m-0 p-0 leading-relaxed selection:bg-primary/30"
          style={{
            fontFamily: '"Fira Code", monospace',
            whiteSpace: 'pre',
            overflowWrap: 'normal',
            overflowX: 'auto',
          }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for PrismJS highlighting
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </div>
  )
}
