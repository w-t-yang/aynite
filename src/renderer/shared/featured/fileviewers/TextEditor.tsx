import type React from 'react'
import { useMemo } from 'react'
import Editor from 'react-simple-code-editor'
import { highlightCode } from '../../lib/syntax'
import { cn } from '../../lib/utils'
import type { FileInfo } from '../../types/files'

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
}

/**
 * TextEditor provides a themed, syntax-highlighted editor that matches the look of TextViewer.
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
}) => {
  const effectiveExtension = extension || file?.extension || 'txt'
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
            // biome-ignore lint/suspicious/noArrayIndexKey: Line numbers are stable
            <div key={i + 1} className="leading-relaxed h-6">
              {i + 1}
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto relative h-full" onScroll={onScroll}>
        <Editor
          value={content}
          onValueChange={onChange}
          highlight={(code) => highlightCode(code, effectiveExtension)}
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
