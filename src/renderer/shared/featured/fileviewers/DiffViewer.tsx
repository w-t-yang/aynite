import { diffLines } from 'diff'
import { useMemo, useState } from 'react'
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
}: DiffViewerProps) {
  const { themes, activeThemeId } = useView()
  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  const { lines: diffLines, hunks } = useMemo(
    () => buildDiffData(headContent, currentContent),
    [headContent, currentContent],
  )

  const [processedHunks, setProcessedHunks] = useState<Set<string>>(new Set())

  const ext = extension || 'txt'

  const hunkIndex = useMemo(() => {
    const map = new Map<number, DiffHunk>()
    for (const hunk of hunks) {
      map.set(hunk.lineIndex, hunk)
    }
    return map
  }, [hunks])

  const handleStage = async (hunk: DiffHunk) => {
    if (!filePath) return
    const result = await (window as any).aynite.stageHunk({
      filePath,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
    })
    if (!result?.error) {
      setProcessedHunks((prev) => new Set([...prev, hunk.id]))
    }
  }

  const handleDiscard = async (hunk: DiffHunk) => {
    if (!filePath) return
    const result = await (window as any).aynite.discardHunk({
      filePath,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
    })
    if (!result?.error) {
      setProcessedHunks((prev) => new Set([...prev, hunk.id]))
    }
  }

  function renderContent() {
    const elements: React.ReactNode[] = []
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i]

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
            {line.type === 'added'
              ? '+'
              : line.type === 'removed'
                ? '-'
                : ''}
          </span>
          <span
            className="flex-1 px-1 truncate"
            style={{
              fontFamily: '"Fira Code", monospace',
              whiteSpace: 'pre',
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for PrismJS highlighting
            dangerouslySetInnerHTML={{
              __html: line.value
                ? highlightCode(line.value, ext)
                : '<br>',
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
            className="flex h-7 items-center gap-1.5 px-2 bg-accent/20 border-y border-border/30"
          >
            <span className="text-[10px] text-muted-foreground/60 mr-1">
              Hunk:
            </span>
            <button
              type="button"
              onClick={() => handleStage(hunk)}
              className="text-[10px] px-2 py-0.5 rounded bg-green-600/15 text-green-700 dark:text-green-400 hover:bg-green-600/30 transition-colors"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => handleDiscard(hunk)}
              className="text-[10px] px-2 py-0.5 rounded bg-red-600/15 text-red-700 dark:text-red-400 hover:bg-red-600/30 transition-colors"
            >
              Reject
            </button>
          </div>,
        )
      }
    }
    return elements
  }

  return (
    <div
      className={cn(
        'flex h-full w-full bg-background font-mono text-sm overflow-hidden',
        className,
      )}
    >
      {showLineNumbers && (
        <div className="w-12 shrink-0 bg-sidebar border-r border-border overflow-hidden select-none">
          {diffLines.map((line, _i) => (
            <div
              key={line.id}
              className={cn(
                'h-6 leading-relaxed text-right pr-2 text-muted-foreground/40',
                line.type === 'removed' && 'opacity-0',
              )}
            >
              {line.lineNumber || ''}
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto">{renderContent()}</div>
    </div>
  )
}
