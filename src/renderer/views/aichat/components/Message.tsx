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
import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PROTOCOL } from '../../../../lib/constants/app'
import type { ChatMessage } from '../../../../lib/types/chat'
import { Button } from '../../../shared/basic/Button'
import { Collapsible } from '../../../shared/basic/Collapsible'
import { cn } from '../../../shared/lib/utils'
import { isErrorMessage } from '../utils/message'

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

const ToolPartRenderer = memo(({ part }: { part: any }) => {
  const { toolName, state, errorText } = part
  const input = part.input ?? part.args
  const output = part.output ?? part.result
  const isStreaming = state === 'input-streaming'
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

  let Icon = Terminal
  if (toolName.includes('file')) Icon = FileText
  if (toolName.includes('dir') || toolName.includes('folder')) Icon = FolderOpen
  if (toolName.includes('write')) Icon = Save

  // Robust title extraction: prefer the command, then the primary argument, then the tool name
  const getToolTitle = () => {
    // 1. Try to find a command-like string in direct or nested args
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
    const cmd = getCmd(actualArgs)
    if (cmd) return cmd

    // 2. Fallback to tool name
    return toolName.toUpperCase().replace(/_/g, ' ')
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
        <pre
          className={cn(
            'text-[12px] font-mono whitespace-pre-wrap max-h-96 overflow-auto py-2 px-3 rounded bg-black/10',
            isError ? 'text-destructive/90' : 'text-muted-foreground/80',
          )}
        >
          {isResult ? (
            output !== undefined && output !== null && output !== '' ? (
              typeof output === 'string' ? (
                output
              ) : (
                JSON.stringify(output, null, 2)
              )
            ) : (
              errorText || '(No output)'
            )
          ) : (
            <div className="flex items-center gap-2 text-primary animate-pulse">
              <span>{isStreaming ? 'Streaming Input...' : 'Executing...'}</span>
            </div>
          )}
        </pre>
        {toolName !== 'run_command' && toolArgs && (
          <div className="px-1 opacity-40 hover:opacity-100 transition-opacity">
            <div className="text-[10px] font-bold mb-1 opacity-50 uppercase tracking-wider">
              Arguments
            </div>
            <pre className="text-[10px] font-mono px-2 py-1 bg-black/5 rounded overflow-auto max-h-20">
              {typeof toolArgs === 'string'
                ? toolArgs
                : JSON.stringify(toolArgs, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Collapsible>
  )
})

const CommandResultRenderer = memo(
  ({
    result,
    exitCode,
  }: {
    command: string
    result: string
    exitCode?: number
  }) => {
    const isError = exitCode !== undefined && exitCode !== 0
    return (
      <div className="mx-4 rounded-md border border-border/20 bg-muted/10 overflow-hidden">
        <pre
          className={cn(
            'text-[12px] font-mono whitespace-pre-wrap max-h-[400px] overflow-auto leading-relaxed px-4 py-3',
            isError ? 'text-destructive/90' : 'text-muted-foreground',
          )}
        >
          {result}
        </pre>
      </div>
    )
  },
)

// ─── Role Renderers ──────────────────────────────────────────────────

function SystemMessage({ msg }: { msg: ChatMessage }) {
  const parts = (msg.parts ||
    (Array.isArray(msg.content) ? msg.content : [])) as any[]
  const content =
    parts.length > 0
      ? parts.map((p) => p.text || '').join('')
      : typeof msg.content === 'string'
        ? msg.content
        : ''
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
  msg: ChatMessage
  onRevert: () => void
}) {
  const { id } = msg
  const parts = (msg.parts ||
    (Array.isArray(msg.content) ? msg.content : [])) as any[]
  const text =
    parts && parts.length > 0
      ? parts.map((p) => p.text || '').join('')
      : typeof msg.content === 'string'
        ? msg.content
        : ''

  const formatMentions = (t: string) => {
    // Split by any mention pattern, keeping the mentions in the result array
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
        {(msg as any).commandResults?.length > 0 && (
          <div className="space-y-2 mt-2">
            {(msg as any).commandResults.map((res: any) => (
              <CommandResultRenderer
                key={res.command}
                command={res.command}
                result={res.result}
                exitCode={res.exitCode}
              />
            ))}
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
  msg: ChatMessage
  isLast: boolean
  isStreaming: boolean
  onCopy: (t: string) => void
  onOpenFile: (p: string) => void
  onRevert: () => void
}) {
  const parts = (msg.parts ||
    (Array.isArray(msg.content) ? msg.content : [])) as any[]
  const fullText =
    parts.length > 0
      ? parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('')
      : typeof msg.content === 'string'
        ? msg.content
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
  msg: ChatMessage
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
      case 'tool':
      case 'tool' as any: {
        const parts = (msg.parts ||
          (Array.isArray(msg.content) ? msg.content : [])) as any[]
        const visibleParts = parts.filter(
          (p: any) =>
            p.type === 'tool-result' ||
            p.state === 'output-available' ||
            p.state === 'output-error',
        )
        if (visibleParts.length === 0) return null
        return (
          <div className="opacity-90 mb-3 px-6 space-y-2">
            {visibleParts.map((p: any, i: number) => (
              <ToolPartRenderer
                key={p.toolCallId || `tool-res-${i}`}
                part={p}
              />
            ))}
          </div>
        )
      }
      default:
        return null
    }
  },
)

MessageItem.displayName = 'MessageItem'
