import type { UIMessage } from 'ai'
import {
  AlertTriangle,
  Bot,
  Clipboard,
  FileText,
  FolderOpen,
  RotateCcw,
  Save,
  Terminal,
} from 'lucide-react'
import { memo, useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PROTOCOL } from '../../../../lib/constants/app'
import { Button } from '../../../shared/basic/Button'
import { Collapsible } from '../../../shared/basic/Collapsible'
import { cn } from '../../../shared/lib/utils'
import { isErrorMessage } from '../utils/message'

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Format an ISO timestamp string to a short time display (e.g. "2:30 PM").
 * Returns null if the timestamp is missing or invalid.
 */
function formatTime(createdAt?: string): string | null {
  if (!createdAt) return null
  try {
    return new Date(createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

// ─── Sub-renderers ───────────────────────────────────────────────────

const MarkdownRenderer = memo(
  ({
    content,
    isStreaming,
    onOpenFile,
  }: {
    content: string
    isStreaming?: boolean
    onOpenFile: (p: string) => void
  }) => (
    <div
      className={cn(
        'markdown-body prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed selection:bg-primary/30',
        isStreaming &&
          "after:content-['▋'] after:ml-0.5 after:animate-pulse after:text-primary",
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => {
            const href = props.href || ''
            const filePrefix = `${PROTOCOL}://file?path=`
            if (href.startsWith(filePrefix)) {
              const path = decodeURIComponent(href.replace(filePrefix, ''))
              return (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault()
                    onOpenFile(path)
                  }}
                  className="text-primary hover:underline cursor-pointer inline p-0 bg-transparent border-none align-baseline font-inherit h-auto"
                >
                  {props.children}
                </Button>
              )
            }
            return (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              />
            )
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  ),
)

/**
 * Renders long text progressively in chunks to avoid UI freezes.
 * Shows the first chunk immediately, then appends remaining chunks
 * via requestAnimationFrame to let the browser breathe between frames.
 */
function ProgressiveOutput({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('')
  const CHUNK_SIZE = 500
  const isLong = text.length > CHUNK_SIZE

  useEffect(() => {
    if (!isLong) {
      setDisplayed(text)
      return
    }

    let cancelled = false
    let pos = 0

    const renderNext = () => {
      if (cancelled) return
      const nextPos = Math.min(pos + CHUNK_SIZE, text.length)
      setDisplayed(text.slice(0, nextPos))
      pos = nextPos
      if (pos < text.length) {
        requestAnimationFrame(renderNext)
      }
    }

    // Show first chunk immediately
    const firstChunk = text.slice(0, CHUNK_SIZE)
    setDisplayed(firstChunk)
    pos = CHUNK_SIZE

    if (text.length > CHUNK_SIZE) {
      requestAnimationFrame(renderNext)
    }

    return () => {
      cancelled = true
    }
  }, [text, isLong])

  return <>{isLong ? displayed : text}</>
}

const ToolPartRenderer = memo(({ part }: { part: any }) => {
  const { toolName, state, errorText } = part
  const input = part.input ?? part.args
  const output = part.output ?? part.result
  const isStreaming = state === 'input-streaming'
  const isExecuting = state === 'executing'
  const isCall =
    part.type === 'tool-call' || state === 'input-available' || isStreaming
  const isResult =
    part.type === 'tool-result' ||
    state === 'output-available' ||
    state === 'output-error'

  if (!isResult && !isCall) return null
  if (isCall && !input) return null // Don't show empty call blocks yet

  const isError =
    state === 'output-error' || part.isError || isErrorMessage(output)

  let toolArgs = input
  if (typeof toolArgs === 'string') {
    try {
      toolArgs = JSON.parse(toolArgs)
    } catch {
      /* ignore */
    }
  }

  // Truncate large content to prevent UI freezes from rendering huge strings
  const truncateContent = (text: string, maxLen = 2000): string => {
    if (text.length <= maxLen) return text
    return `${text.slice(0, maxLen)}\n\n... (truncated, ${text.length - maxLen} more chars)`
  }

  const formatOutput = (val: unknown): string => {
    if (val === undefined || val === null) return ''
    const text = typeof val === 'string' ? val : JSON.stringify(val, null, 2)
    return truncateContent(text, 2000)
  }

  const formatArgs = (args: unknown): string => {
    const text = typeof args === 'string' ? args : JSON.stringify(args, null, 2)
    return truncateContent(text, 1000)
  }

  let Icon = Terminal
  if (toolName.includes('file')) Icon = FileText
  if (toolName.includes('dir') || toolName.includes('folder')) Icon = FolderOpen
  if (toolName.includes('write')) Icon = Save
  if (toolName.includes('task')) Icon = Clipboard

  // Title always starts with the tool name, followed by the primary argument if available
  const getToolTitle = () => {
    const formattedName = toolName.toUpperCase().replace(/_/g, ' ')

    // Special handling for task tools
    if (toolName === 'create_task' || toolName === 'update_task') {
      const actualArgs = toolArgs?.args || toolArgs?.input || toolArgs
      if (toolName === 'create_task') {
        const tasks = actualArgs?.tasks
        if (Array.isArray(tasks) && tasks.length > 0) {
          return `${formattedName}  │  ${tasks.length} items`
        }
        return formattedName
      }
      if (toolName === 'update_task') {
        const idx = actualArgs?.taskIndex
        const status = actualArgs?.status
        if (idx !== undefined) {
          return `${formattedName}  │  Task ${idx + 1} → ${status || 'updated'}`
        }
        return formattedName
      }
    }

    const getCmd = (obj: any): string | null => {
      if (!obj || typeof obj !== 'object') return null
      return (
        obj.command ||
        obj.path ||
        obj.pattern ||
        obj.url ||
        obj.query ||
        obj.name ||
        null
      )
    }

    const actualArgs = toolArgs?.args || toolArgs?.input || toolArgs
    let cmd = getCmd(actualArgs)

    // For run_command, strip leading cd as the cwd parameter handles it
    if (cmd && toolName === 'run_command') {
      cmd = cmd.replace(/^cd\s+\S+(\s*[;&|]{1,2}\s*)?/, '').trim()
    }

    if (cmd) return `${formattedName}  │  ${cmd}`

    return formattedName
  }

  const title = getToolTitle()

  return (
    <Collapsible
      title={title}
      icon={isError ? AlertTriangle : Icon}
      colorClass={cn(
        isError
          ? 'border-destructive/20 bg-destructive/[0.01]'
          : 'border-green-500/10 bg-green-500/[0.01]',
      )}
      defaultExpanded={false}
      compact
    >
      <div className="space-y-2">
        {toolArgs && (
          <div className="px-1">
            <div className="text-[10px] font-bold mb-1 opacity-50 uppercase tracking-wider">
              Arguments
            </div>
            <pre className="text-[10px] font-mono px-2 py-1 bg-black/5 rounded overflow-auto max-h-20">
              {formatArgs(toolArgs)}
            </pre>
          </div>
        )}
        <pre
          className={cn(
            'text-[12px] font-mono whitespace-pre-wrap max-h-96 overflow-auto py-2 px-3 rounded bg-black/10',
            isError ? 'text-destructive/90' : 'text-muted-foreground/80',
          )}
        >
          {isResult ? (
            output !== undefined && output !== null && output !== '' ? (
              <ProgressiveOutput text={formatOutput(output)} />
            ) : (
              errorText || '(No output)'
            )
          ) : isExecuting && output ? (
            <span>
              <span className="inline-block w-1.5 h-4 bg-primary/70 ml-0.5 animate-pulse align-middle" />
            </span>
          ) : (
            <div className="flex items-center gap-2 text-primary animate-pulse">
              <span>{isStreaming ? 'Streaming Input...' : 'Executing...'}</span>
            </div>
          )}
        </pre>
      </div>
    </Collapsible>
  )
})

// ─── Role Renderers ──────────────────────────────────────────────────

function SystemMessage({ msg }: { msg: UIMessage }) {
  const parts = msg.parts as any[]
  const content =
    parts.length > 0 ? parts.map((p) => p.text || '').join('') : ''
  return (
    <div className="opacity-30 hover:opacity-100 transition-opacity mb-3">
      <Collapsible
        title="System"
        icon={Terminal}
        colorClass="border-muted/20"
        compact
      >
        <div className="text-[12px] font-mono text-muted-foreground whitespace-pre-wrap leading-tight">
          {content}
        </div>
      </Collapsible>
    </div>
  )
}

function UserMessage({
  msg,
  onRevert,
}: {
  msg: UIMessage
  onRevert: () => void
}) {
  const { id } = msg
  const parts = msg.parts as any[]
  const text =
    parts && parts.length > 0 ? parts.map((p) => p.text || '').join('') : ''

  const formatMentions = (t: string) => {
    const segments = t.split(
      /(>cmd\[.*?\]\(.*?\)|@(?:file|dir)\[.*?\]\(.*?\)|(?:\s|^)\/skill\[.*?\]\(.*?\))/g,
    )
    return segments.map((part, i) => {
      if (!part) return null

      const cmdMatch = part.match(/^>cmd\[(.*?)\]\((.*?)\)$/)
      const fileMatch = part.match(/^@(?:file|dir)\[(.*?)\]\((.*?)\)$/)
      const skillMatch = part.match(/^(?:\s|^)\/skill\[(.*?)\]\((.*?)\)$/)

      const keyPrefix = `${id}-${i}`

      if (cmdMatch) {
        return (
          <span
            key={`${keyPrefix}-cmd`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[13px] font-mono border border-amber-500/10"
          >
            <Terminal size={12} />
            {cmdMatch[1]}
          </span>
        )
      }
      if (fileMatch) {
        return (
          <span
            key={`${keyPrefix}-file`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[13px] font-mono border border-blue-500/10"
          >
            <FileText size={12} />
            {fileMatch[1]}
          </span>
        )
      }
      if (skillMatch) {
        return (
          <span
            key={`${keyPrefix}-skill`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[13px] font-mono border border-purple-500/10"
          >
            <Bot size={12} />
            {skillMatch[1]}
          </span>
        )
      }
      return <span key={`${keyPrefix}-text`}>{part}</span>
    })
  }

  return (
    <div className="group/user relative mb-3">
      <div className="bg-foreground/[0.03] border border-border/5 rounded-xl py-3 px-4 mx-4 group-hover/user:bg-foreground/[0.05] transition-all">
        <div className="text-foreground/90 text-[15px] leading-relaxed whitespace-pre-wrap font-medium tracking-tight">
          {formatMentions(text)}
        </div>
        {(msg as any).createdAt && (
          <div className="text-right mt-1">
            <span className="text-[10px] text-muted-foreground/40 font-medium select-none">
              {formatTime((msg as any).createdAt)}
            </span>
          </div>
        )}
        <div className="absolute bottom-1 right-8 opacity-0 group-hover/user:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevert}
            title="Revert to here"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm border border-border/10 rounded-md"
          >
            <RotateCcw size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}

function AssistantMessage({
  msg,
  isLast,
  isStreaming,
  onCopy,
  onOpenFile,
  onRevert,
}: {
  msg: UIMessage
  isLast: boolean
  isStreaming: boolean
  onCopy: (t: string) => void
  onOpenFile: (p: string) => void
  onRevert: () => void
}) {
  const parts = msg.parts as any[]
  const fullText =
    parts.length > 0
      ? parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('')
      : ''

  const hasNoParts = parts.length === 0
  const hasToolParts = parts.some(
    (p) =>
      p.type === 'dynamic-tool' ||
      p.type === 'tool-call' ||
      p.type === 'tool-result' ||
      (p.type as string).startsWith('tool-'),
  )
  const hasVisibleParts = parts.some((p) => {
    if (p.type === 'text' || p.type === 'reasoning') return true
    if (
      p.type === 'dynamic-tool' ||
      p.type === 'tool-call' ||
      p.type === 'tool-result' ||
      (p.type as string).startsWith('tool')
    ) {
      if (p.type === 'tool-result') return true
      if (p.type === 'tool-call') return !!(p.args || p.input)
      const isCall =
        p.state === 'input-available' || p.state === 'input-streaming'
      const hasInput = !!(p as any).input || !!(p as any).args
      return (
        p.state === 'output-available' ||
        p.state === 'output-error' ||
        p.state === 'executing' ||
        (isCall && hasInput)
      )
    }
    return false
  })

  if (!hasVisibleParts && !fullText && !isStreaming) return null

  return (
    <div className="group/assistant relative mb-3">
      <div className="space-y-4 py-3 px-6">
        {hasNoParts && fullText && (
          <MarkdownRenderer
            content={fullText}
            isStreaming={isStreaming}
            onOpenFile={onOpenFile}
          />
        )}
        {parts.map((part, i) => {
          const isPartLast = i === parts.length - 1
          const isPartStreaming = isStreaming && isPartLast

          switch (part.type) {
            case 'text':
              return (
                <MarkdownRenderer
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable
                  key={`text-${msg.id}-${i}`}
                  content={part.text}
                  isStreaming={isPartStreaming}
                  onOpenFile={onOpenFile}
                />
              )
            case 'reasoning':
              return (
                <Collapsible
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable
                  key={`reasoning-${msg.id}-${i}`}
                  title="Thinking"
                  icon={Bot}
                  colorClass="border-primary/10 bg-primary/[0.01]"
                  defaultExpanded={isLast}
                  compact
                >
                  <div
                    className={cn(
                      'text-[12px] leading-snug text-muted-foreground/60 italic whitespace-pre-wrap font-serif',
                      isPartStreaming &&
                        "after:content-['...'] after:ml-0.5 after:animate-pulse after:text-primary",
                    )}
                  >
                    {part.text}
                  </div>
                </Collapsible>
              )
            case 'tool':
            case 'tool-call':
            case 'tool-result':
            case 'dynamic-tool':
              return (
                <ToolPartRenderer
                  key={part.toolCallId || `tool-${i}`}
                  part={part}
                />
              )
            default:
              if (part.type.startsWith('tool-')) {
                return (
                  <ToolPartRenderer
                    key={part.toolCallId || `tool-${i}`}
                    part={part}
                  />
                )
              }
              return null
          }
        })}
      </div>

      {(msg as any).createdAt && (
        <div className="text-right px-6 pb-1 -mt-2">
          <span className="text-[10px] text-muted-foreground/40 font-medium select-none">
            {formatTime((msg as any).createdAt)}
          </span>
        </div>
      )}

      {!isStreaming && !hasToolParts && (
        <div className="absolute bottom-1 right-8 flex gap-1 opacity-0 group-hover/assistant:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRevert}
            title="Revert to here"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm border border-border/10 rounded-md"
          >
            <RotateCcw size={14} />
          </Button>
          {fullText && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(fullText)}
              title="Copy response"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground bg-background/50 backdrop-blur-sm border border-border/10 rounded-md"
            >
              <Clipboard size={14} />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Message Item ──────────────────────────────────────────────

interface MessageItemProps {
  msg: UIMessage
  idx: number
  total: number
  isStreaming: boolean
  onOpenFile: (path: string) => void
  onCopy: (text: string) => void
  onRevert: () => void
}

export const MessageItem = memo(
  ({
    msg,
    idx,
    total,
    isStreaming,
    onOpenFile,
    onCopy,
    onRevert,
  }: MessageItemProps) => {
    const isLast = idx === total - 1
    switch (msg.role) {
      case 'system':
        return <SystemMessage msg={msg} />
      case 'user':
        return <UserMessage msg={msg} onRevert={onRevert} />
      case 'assistant':
        return (
          <AssistantMessage
            msg={msg}
            isLast={isLast}
            isStreaming={isStreaming}
            onCopy={onCopy}
            onOpenFile={onOpenFile}
            onRevert={onRevert}
          />
        )
      default:
        return null
    }
  },
)

MessageItem.displayName = 'MessageItem'
