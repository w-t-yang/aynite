import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import Editor from 'react-simple-code-editor'
import type { FileInfo } from '../../../../lib/types/files'
import {
  getSearchMatchLine,
  highlightCode,
  highlightWithSearch,
} from '../../lib/syntax'
import { cn } from '../../lib/utils'

interface TextEditorProps {
  content: string
  onChange: (content: string) => void
  file?: FileInfo
  extension?: string
  className?: string
  showLineNumbers?: boolean
  readOnly?: boolean
  onCursorChange?: (pos: number) => void
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
  textareaId?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement>
  /** Search query for highlighting matches */
  searchQuery?: string
  /** Index of the active (current) search match */
  activeMatchIndex?: number
  /** Called with total match count whenever search highlights are computed */
  onSearchResult?: (total: number) => void
}

/**
 * TextEditor provides a themed, syntax-highlighted code editor.
 * Used by both Edit mode (editable) and View mode (readOnly).
 */
export const TextEditor: React.FC<TextEditorProps> = ({
  content,
  onChange,
  file,
  extension,
  className,
  showLineNumbers = true,
  readOnly = false,
  onCursorChange,
  onScroll,
  textareaId,
  textareaRef,
  searchQuery,
  activeMatchIndex,
  onSearchResult,
}) => {
  const effectiveExtension = extension || file?.extension || 'txt'
  const lines = useMemo(() => content.split('\n'), [content])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Track match count
  const totalMatches = useMemo(() => {
    if (!searchQuery) return 0
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const matches = content.match(regex)
    const count = matches?.length ?? 0
    return count
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
    const lineHeight = 24 // matches the leading-relaxed h-6 (1.5rem ≈ 24px)
    const _padding = 16 // matches Editor padding
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
            // biome-ignore lint/suspicious/noArrayIndexKey: Line numbers are stable
            <div key={i + 1} className="leading-relaxed h-6">
              {i + 1}
            </div>
          ))}
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto relative h-full"
        onScroll={onScroll}
      >
        <Editor
          value={content}
          onValueChange={onChange}
          highlight={(code) =>
            searchQuery
              ? highlightWithSearch(
                  code,
                  effectiveExtension,
                  searchQuery,
                  activeMatchIndex,
                )
              : highlightCode(code, effectiveExtension)
          }
          padding={16}
          readOnly={readOnly}
          textareaId={textareaId}
          // @ts-expect-error - ref prop is supported by react-simple-code-editor but not always in types
          ref={textareaRef}
          onKeyUp={() => {
            if (onCursorChange && textareaRef?.current) {
              onCursorChange(textareaRef.current.selectionStart)
            }
          }}
          onClick={() => {
            if (onCursorChange && textareaRef?.current) {
              onCursorChange(textareaRef.current.selectionStart)
            }
          }}
          className="min-h-full font-mono text-sm leading-relaxed outline-none"
          style={{
            fontFamily: '"Fira Code", monospace',
            minHeight: '100%',
          }}
          textareaClassName="outline-none focus:ring-0 !caret-primary"
          preClassName="selection:bg-primary/30"
        />
      </div>
    </div>
  )
}
