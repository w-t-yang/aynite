import { diffLines } from 'diff'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useView } from '../../../views/ViewContext'
import { highlightCode } from '../../lib/syntax'
import { cn } from '../../lib/utils'

interface DiffViewerProps {
  headContent: string
  currentContent: string
  extension?: string
  className?: string
  showLineNumbers?: boolean
  filePath?: string
  onHunkProcessed?: () => void
}

interface DiffRenderLine {
  type: 'added' | 'removed' | 'unchanged'
  value: string
  lineNumber?: number
  id: string
}

interface DiffHunk {
  id: string
  oldStart: number
  oldLines: string[]
  newStart: number
  newLines: string[]
  /** index in the lines array where the hunk's last content line sits */
  lineIndex: number
}

type ViewMode = 'full' | 'changes-only'

function buildDiffData(head: string, current: string) {
  const parts = diffLines(head, current)
  const lines: DiffRenderLine[] = []
  const hunks: DiffHunk[] = []
  let currentLineNum = 0
  let headLineNum = 0
  let lineId = 0
  let hunkId = 0
  let currentHunk: {
    removed: string[]
    oldStart: number
  } | null = null

  for (const part of parts) {
    const partLines = part.value.replace(/\n$/, '').split('\n')

    if (part.added) {
      const addedLines: string[] = []
      for (const line of partLines) {
        currentLineNum++
        addedLines.push(line)
        lines.push({
          type: 'added',
          value: line,
          lineNumber: currentLineNum,
          id: `l${lineId++}`,
        })
      }

      if (currentHunk) {
        // Removal followed by addition → single change hunk
        const newStart = currentLineNum - addedLines.length + 1
        hunks.push({
          id: `h${hunkId++}`,
          oldStart: currentHunk.oldStart,
          oldLines: currentHunk.removed,
          newStart,
          newLines: addedLines,
          lineIndex: lines.length - 1,
        })
        currentHunk = null
      } else {
        // Pure insertion
        hunks.push({
          id: `h${hunkId++}`,
          oldStart: headLineNum + 1,
          oldLines: [],
          newStart: currentLineNum - addedLines.length + 1,
          newLines: addedLines,
          lineIndex: lines.length - 1,
        })
      }
    } else if (part.removed) {
      const removedLines: string[] = []
      for (const line of partLines) {
        headLineNum++
        removedLines.push(line)
        lines.push({ type: 'removed', value: line, id: `l${lineId++}` })
      }
      currentHunk = {
        removed: removedLines,
        oldStart: headLineNum - removedLines.length + 1,
      }
    } else {
      // Unchanged — flush pending pure-deletion hunk
      if (currentHunk) {
        hunks.push({
          id: `h${hunkId++}`,
          oldStart: currentHunk.oldStart,
          oldLines: currentHunk.removed,
          newStart: currentLineNum + 1,
          newLines: [],
          lineIndex: lines.length,
        })
        currentHunk = null
      }
      for (const line of partLines) {
        headLineNum++
        currentLineNum++
        lines.push({
          type: 'unchanged',
          value: line,
          lineNumber: currentLineNum,
          id: `l${lineId++}`,
        })
      }
    }
  }

  // Trailing pure-deletion hunk
  if (currentHunk) {
    hunks.push({
      id: `h${hunkId++}`,
      oldStart: currentHunk.oldStart,
      oldLines: currentHunk.removed,
      newStart: currentLineNum + 1,
      newLines: [],
      lineIndex: lines.length - 1,
    })
  }

  return { lines, hunks }
}

export function DiffViewer({
  headContent,
  currentContent,
  extension,
  className,
  showLineNumbers = true,
  filePath,
  onHunkProcessed,
}: DiffViewerProps) {
  const { themes, activeThemeId } = useView()
  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  const { lines: diffLines, hunks } = useMemo(
    () => buildDiffData(headContent, currentContent),
    [headContent, currentContent],
  )

  const [processedHunks, setProcessedHunks] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('full')

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hunkRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const ext = extension || 'txt'

  const hunkIndex = useMemo(() => {
    const map = new Map<number, DiffHunk>()
    for (const hunk of hunks) {
      map.set(hunk.lineIndex, hunk)
    }
    return map
  }, [hunks])

  const unprocessedHunks = useMemo(
    () => hunks.filter((h) => !processedHunks.has(h.id)),
    [hunks, processedHunks],
  )

  const visibleLineIndices = useMemo(() => {
    return diffLines
      .map((line, idx) => ({ line, idx }))
      .filter(
        ({ line }) => viewMode !== 'changes-only' || line.type !== 'unchanged',
      )
      .map(({ idx }) => idx)
  }, [diffLines, viewMode])

  const handleStage = async (hunk: DiffHunk) => {
    if (!filePath) return
    try {
      const result = await (window as any).aynite.stageHunk({
        filePath,
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
      })
      if (!result?.error) {
        setProcessedHunks((prev) => new Set([...prev, hunk.id]))
        onHunkProcessed?.()
      } else {
        console.error('[DiffViewer] stageHunk returned error:', result.error)
      }
    } catch (e) {
      console.error('[DiffViewer] stageHunk threw:', e)
    }
  }

  const handleDiscard = async (hunk: DiffHunk) => {
    if (!filePath) return
    try {
      const result = await (window as any).aynite.discardHunk({
        filePath,
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
      })
      if (!result?.error) {
        setProcessedHunks((prev) => new Set([...prev, hunk.id]))
        onHunkProcessed?.()
      } else {
        console.error('[DiffViewer] discardHunk returned error:', result.error)
      }
    } catch (e) {
      console.error('[DiffViewer] discardHunk threw:', e)
    }
  }

  const setHunkRef = useCallback(
    (hunkId: string, el: HTMLDivElement | null) => {
      if (el) {
        hunkRefs.current.set(hunkId, el)
      } else {
        hunkRefs.current.delete(hunkId)
      }
    },
    [],
  )

  const scrollToChange = useCallback(
    (direction: 'prev' | 'next') => {
      const container = scrollContainerRef.current
      if (!container) return

      // Get all unprocessed hunk entries sorted by position
      const entries = unprocessedHunks
        .map((h) => {
          const el = hunkRefs.current.get(h.id)
          if (!el) return null
          return { id: h.id, el, top: el.offsetTop }
        })
        .filter(Boolean) as { id: string; el: HTMLDivElement; top: number }[]

      if (entries.length === 0) return
      entries.sort((a, b) => a.top - b.top)

      // Find which hunk is closest to the viewport center
      const viewCenter = container.scrollTop + container.clientHeight / 2
      let currentIdx = 0
      let minDist = Infinity
      for (let i = 0; i < entries.length; i++) {
        const dist = Math.abs(entries[i].top - viewCenter)
        if (dist < minDist) {
          minDist = dist
          currentIdx = i
        }
      }

      let targetIdx: number
      if (direction === 'next') {
        targetIdx = currentIdx + 1
        if (targetIdx >= entries.length) return // at last change, no wrap
      } else {
        targetIdx = currentIdx - 1
        if (targetIdx < 0) return // at first change, no wrap
      }

      entries[targetIdx].el.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    },
    [unprocessedHunks],
  )

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'full' ? 'changes-only' : 'full'))
  }, [])

  function renderContent() {
    const elements: React.ReactNode[] = []
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i]

      // Skip unchanged lines in changes-only mode
      if (viewMode === 'changes-only' && line.type === 'unchanged') {
        continue
      }

      const bg =
        line.type === 'added'
          ? isDark
            ? 'bg-green-900/40'
            : 'bg-green-100'
          : line.type === 'removed'
            ? isDark
              ? 'bg-red-900/40'
              : 'bg-red-100'
            : ''

      const prefix =
        line.type === 'added'
          ? 'text-green-600'
          : line.type === 'removed'
            ? 'text-red-600'
            : 'text-muted-foreground/30'

      elements.push(
        <div key={line.id} className={cn('flex h-6 leading-relaxed', bg)}>
          <span
            className={cn(
              'w-5 shrink-0 text-center select-none text-[10px]',
              prefix,
            )}
          >
            {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ''}
          </span>
          <span
            className="flex-1 px-1 truncate"
            style={{
              fontFamily: '"Fira Code", monospace',
              whiteSpace: 'pre',
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for PrismJS highlighting
            dangerouslySetInnerHTML={{
              __html: line.value ? highlightCode(line.value, ext) : '<br>',
            }}
          />
        </div>,
      )

      // Hunk actions row
      const hunk = hunkIndex.get(i)
      if (hunk && !processedHunks.has(hunk.id)) {
        elements.push(
          <div
            key={`${line.id}-actions`}
            ref={(el) => setHunkRef(hunk.id, el)}
            className="flex h-7 items-center px-3 bg-accent/20 border-y border-border/30"
          >
            <div className="flex-1 min-w-0" />
            <div className="sticky right-0 z-10 flex items-center gap-1.5 bg-accent/20 pl-2 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]">
              <button
                type="button"
                onClick={() => handleStage(hunk)}
                className="text-[10px] px-2 py-0.5 rounded bg-green-600/15 text-green-700 dark:text-green-400 hover:bg-green-600/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => handleDiscard(hunk)}
                className="text-[10px] px-2 py-0.5 rounded bg-red-600/15 text-red-700 dark:text-red-400 hover:bg-red-600/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                Reject
              </button>
            </div>
          </div>,
        )
      }
    }
    return elements
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full w-full bg-background font-mono text-sm',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-center h-8 border-b border-border bg-muted/30 select-none shrink-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={toggleViewMode}
            className="px-2 py-1 rounded hover:bg-accent cursor-pointer transition-colors"
            title={`${viewMode === 'full' ? 'Show changes only' : 'Show full file'}`}
          >
            <span className={cn(unprocessedHunks.length === 0 && 'opacity-40')}>
              {unprocessedHunks.length} change
              {unprocessedHunks.length !== 1 ? 's' : ''}
            </span>
          </button>
          <span className="text-border/50 mx-0.5">|</span>
          <button
            type="button"
            onClick={() => scrollToChange('prev')}
            className="p-1 rounded hover:bg-accent cursor-pointer transition-colors"
            title="Previous change"
            disabled={unprocessedHunks.length === 0}
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => scrollToChange('next')}
            className="p-1 rounded hover:bg-accent cursor-pointer transition-colors"
            title="Next change"
            disabled={unprocessedHunks.length === 0}
          >
            <ArrowDown size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 overflow-auto min-h-0"
      >
        {showLineNumbers && (
          <div className="w-12 shrink-0 bg-sidebar border-r border-border select-none">
            {visibleLineIndices.map((idx) => {
              const line = diffLines[idx]
              return (
                <div
                  key={line.id}
                  className={cn(
                    'h-6 leading-relaxed text-right pr-2 text-muted-foreground/40',
                    line.type === 'removed' && 'opacity-0',
                  )}
                >
                  {line.lineNumber || ''}
                </div>
              )
            })}
          </div>
        )}
        <div className="flex-1">{renderContent()}</div>
      </div>
    </div>
  )
}
