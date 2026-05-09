import { useMemo } from 'react'
import type { FileInfo } from '../../../../lib/types/files'
import { highlightCode } from '../../lib/syntax'
import { cn } from '../../lib/utils'

interface TextViewerProps {
  content: string
  file?: FileInfo
  extension?: string
  className?: string
  showLineNumbers?: boolean
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
}: TextViewerProps) {
  const effectiveExtension = extension || file?.extension || 'txt'

  const highlightedHtml = useMemo(() => {
    return highlightCode(content, effectiveExtension)
  }, [content, effectiveExtension])

  const lines = useMemo(() => content.split('\n'), [content])

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
      <div className="flex-1 overflow-auto p-4">
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
