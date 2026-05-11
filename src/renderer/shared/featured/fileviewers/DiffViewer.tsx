import { diffLines } from 'diff'
import { useMemo } from 'react'
import { useView } from '../../../views/ViewContext'
import { highlightCode } from '../../lib/syntax'
import { cn } from '../../lib/utils'

interface DiffViewerProps {
  headContent: string
  currentContent: string
  extension?: string
  className?: string
  showLineNumbers?: boolean
}

interface DiffRenderLine {
  type: 'added' | 'removed' | 'unchanged'
  value: string
  lineNumber?: number
  id: string
}

function buildDiffLines(head: string, current: string): DiffRenderLine[] {
  const parts = diffLines(head, current)
  const lines: DiffRenderLine[] = []
  let currentLineNum = 0
  let id = 0

  for (const part of parts) {
    const partLines = part.value.replace(/\n$/, '').split('\n')

    if (part.added) {
      for (const line of partLines) {
        currentLineNum++
        lines.push({ type: 'added', value: line, lineNumber: currentLineNum, id: `d${id++}` })
      }
    } else if (part.removed) {
      for (const line of partLines) {
        lines.push({ type: 'removed', value: line, id: `d${id++}` })
      }
    } else {
      for (const line of partLines) {
        currentLineNum++
        lines.push({ type: 'unchanged', value: line, lineNumber: currentLineNum, id: `d${id++}` })
      }
    }
  }

  return lines
}

export function DiffViewer({
  headContent,
  currentContent,
  extension,
  className,
  showLineNumbers = true,
}: DiffViewerProps) {
  const { themes, activeThemeId } = useView()
  const currentTheme = themes.find((t) => t.id === activeThemeId)
  const isDark = currentTheme?.type === 'dark'

  const diffLines = useMemo(
    () => buildDiffLines(headContent, currentContent),
    [headContent, currentContent],
  )

  const ext = extension || 'txt'

  return (
    <div
      className={cn(
        'flex h-full w-full bg-background font-mono text-sm overflow-hidden',
        className,
      )}
    >
      {showLineNumbers && (
        <div className="w-12 shrink-0 bg-sidebar border-r border-border overflow-hidden select-none">
          {diffLines.map((line, i) => (
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
      <div className="flex-1 overflow-auto">
        {diffLines.map((line, i) => {
          const bg =
            line.type === 'added'
              ? isDark ? 'bg-green-900/40' : 'bg-green-100'
              : line.type === 'removed'
                ? isDark ? 'bg-red-900/40' : 'bg-red-100'
                : ''

          const prefix =
            line.type === 'added'
              ? 'text-green-600'
              : line.type === 'removed'
                ? 'text-red-600'
                : 'text-muted-foreground/30'

          return (
            <div
              key={line.id}
              className={cn('flex h-6 leading-relaxed', bg)}
            >
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
                style={{ fontFamily: '"Fira Code", monospace', whiteSpace: 'pre' }}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for PrismJS highlighting
                dangerouslySetInnerHTML={{
                  __html:
                    line.value
                      ? highlightCode(line.value, ext)
                      : '<br>',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
