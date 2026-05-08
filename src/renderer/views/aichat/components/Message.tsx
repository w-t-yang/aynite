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
import type {
  ChatMessage,
  ReasoningPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from '../../../../lib/types/chat'
import { Button } from '../../../shared/basic/Button'
import { Collapsible } from '../../../shared/basic/Collapsible'
import { cn } from '../../../shared/lib/utils'
import { isErrorMessage } from '../utils/message'

// ─── Sub-renderers for Parts ─────────────────────────────────────────

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
        'markdown-body prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed selection:bg-primary/30 px-2',
        isStreaming &&
          "after:content-['▋'] after:ml-0.5 after:animate-pulse after:text-primary",
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => {
            const href = props.href || ''
            if (href.startsWith('aynite://file?path=')) {
              const path = decodeURIComponent(
                href.replace('aynite://file?path=', ''),
              )
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onOpenFile(path)
                  }}
                  className="text-primary hover:underline cursor-pointer inline p-0 bg-transparent border-none align-baseline font-inherit"
                >
                  {props.children}
                </button>
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

const ReasoningRenderer = memo(
  ({
    part,
    isLast,
    isStreaming,
  }: {
    part: ReasoningPart
    isLast?: boolean
    isStreaming?: boolean
  }) => (
    <Collapsible
      title="Thinking"
      icon={Bot}
      colorClass="border-primary/10 bg-primary/[0.01]"
      defaultExpanded={isLast}
      compact
    >
      <div
        className={cn(
          'text-[12px] leading-snug text-muted-foreground/60 italic whitespace-pre-wrap font-serif px-1',
          isStreaming &&
            "after:content-['...'] after:ml-0.5 after:animate-pulse",
        )}
      >
        {part.text}
      </div>
    </Collapsible>
  ),
)

const ToolCallRenderer = memo(
  ({
    part,
    isLast,
    isStreaming,
  }: {
    part: ToolCallPart
    isLast?: boolean
    isStreaming?: boolean
  }) => {
    const toolName = part.toolName
    let toolArgs = part.args

    if (typeof part.args === 'string') {
      try {
        toolArgs = JSON.parse(part.args)
      } catch {
        // use raw string if not valid JSON yet
      }
    }

    let Icon = Terminal
    const colorClass = 'border-amber-500/10 bg-amber-500/[0.01]'

    if (toolName.includes('file')) Icon = FileText
    if (toolName.includes('dir') || toolName.includes('folder'))
      Icon = FolderOpen
    if (toolName.includes('write')) Icon = Save

    return (
      <Collapsible
        title={isStreaming ? `${toolName}...` : toolName}
        icon={Icon}
        colorClass={cn(
          colorClass,
          isStreaming && 'animate-pulse border-amber-500/30',
        )}
        defaultExpanded={isLast}
        compact
      >
        <pre className="text-[12px] font-mono text-muted-foreground bg-muted/10 p-2 rounded overflow-auto max-h-40">
          {typeof toolArgs === 'string'
            ? toolArgs
            : JSON.stringify(toolArgs, null, 2)}
        </pre>
      </Collapsible>
    )
  },
)

const ToolResultRenderer = memo(({ part }: { part: ToolResultPart }) => {
  const isError = isErrorMessage(part.result)
  return (
    <Collapsible
      title={`Result: ${part.toolName}`}
      icon={isError ? AlertTriangle : FileText}
      colorClass={
        isError
          ? 'border-destructive/20 bg-destructive/[0.01]'
          : 'border-green-500/10 bg-green-500/[0.01]'
      }
      defaultExpanded={false}
      compact
    >
      <pre
        className={cn(
          'text-[12px] font-mono whitespace-pre-wrap max-h-96 overflow-auto p-2 rounded bg-black/10',
          isError ? 'text-destructive/90' : 'text-muted-foreground/80',
        )}
      >
        {typeof part.result === 'string'
          ? part.result
          : JSON.stringify(part.result, null, 2)}
      </pre>
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
      <div className="mx-2 my-2 rounded-md border border-border/20 bg-muted/10 overflow-hidden">
        <pre
          className={cn(
            'text-[12px] font-mono p-3 whitespace-pre-wrap max-h-[400px] overflow-auto leading-relaxed',
            isError ? 'text-destructive/90' : 'text-muted-foreground',
          )}
        >
          {result}
        </pre>
      </div>
    )
  },
)

// ─── Role-based Renderers ───────────────────────────────────────────

function SystemMessage({ content }: { content: string }) {
  return (
    <div className="max-w-4xl mx-auto py-1 px-6 opacity-30 hover:opacity-100 transition-opacity mb-1">
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
  msg: ChatMessage & { role: 'user' }
  onRevert: (id: string) => void
}) {
  const { content, commandResults, id } = msg
  const text =
    typeof content === 'string' ? content : content.map((p) => p.text).join('')

  // Simple formatter for mentions
  const formatMentions = (t: string) => {
    const parts = t.split(
      /(>cmd\[.*?\]\(.*?\)|@(?:file|dir)\[.*?\]\(.*?\)| \/skill\[.*?\]\(.*?\))/g,
    )
    return parts.map((part, i) => {
      const cmdMatch = part.match(/>cmd\[(.*?)\]\((.*?)\)/)
      const fileMatch = part.match(/@(?:file|dir)\[(.*?)\]\((.*?)\)/)
      const skillMatch = part.match(/\/skill\[(.*?)\]\((.*?)\)/)

      if (cmdMatch) {
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are static
            key={i}
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
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are static
            key={i}
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
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are static
            key={i}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[13px] font-mono border border-purple-500/10"
          >
            <Bot size={12} />
            {skillMatch[1]}
          </span>
        )
      }
      // biome-ignore lint/suspicious/noArrayIndexKey: parts are static
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className="max-w-4xl mx-auto mb-2 px-6 group/user relative">
      <div className="bg-foreground/[0.03] border border-border/5 rounded-lg my-1 mx-2 py-1.5 px-2 group-hover/user:bg-foreground/[0.05] transition-all">
        <div className="text-foreground/90 text-[15px] leading-relaxed whitespace-pre-wrap font-medium tracking-tight px-2">
          {formatMentions(text)}
        </div>
        {commandResults && commandResults.length > 0 && (
          <div className="mt-2 space-y-2">
            {commandResults.map((res) => (
              <CommandResultRenderer
                key={res.command}
                command={res.command}
                result={res.result}
                exitCode={res.exitCode}
              />
            ))}
          </div>
        )}
        <div className="absolute top-1 right-8 opacity-0 group-hover/user:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevert(id)}
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
  id,
  content,
  isLast,
  isStreaming,
  onCopy,
  onOpenFile,
  onRevert,
}: {
  id: string
  content:
    | string
    | Array<TextPart | ReasoningPart | ToolCallPart | ToolResultPart>
  isLast: boolean
  isStreaming: boolean
  onCopy: (t: string) => void
  onOpenFile: (p: string) => void
  onRevert: (id: string) => void
}) {
  const parts =
    typeof content === 'string'
      ? [{ type: 'text', text: content } as TextPart]
      : content
  const fullText = parts
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('')

  return (
    <div className="max-w-4xl mx-auto mb-3 px-8 group/assistant relative">
      <div className="py-1.5 px-2 space-y-2">
        {parts.map((part, i) => {
          const isPartLast = i === parts.length - 1
          const isPartStreaming = isStreaming && isPartLast
          const partKey = `${part.type}-${'toolCallId' in part ? part.toolCallId : i}`

          switch (part.type) {
            case 'text':
              return (
                <MarkdownRenderer
                  key={partKey}
                  content={part.text}
                  isStreaming={isPartStreaming}
                  onOpenFile={onOpenFile}
                />
              )
            case 'reasoning':
              return (
                <ReasoningRenderer
                  key={partKey}
                  part={part}
                  isLast={isLast && isPartLast}
                  isStreaming={isPartStreaming}
                />
              )
            case 'tool-call':
              return (
                <ToolCallRenderer
                  key={partKey}
                  part={part}
                  isLast={isLast && isPartLast}
                  isStreaming={isPartStreaming}
                />
              )
            case 'tool-result':
              return <ToolResultRenderer key={partKey} part={part} />
            default:
              return null
          }
        })}
      </div>

      {!isStreaming && (
        <div className="absolute top-1 right-8 flex gap-1 opacity-0 group-hover/assistant:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRevert(id)}
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
      <div className="h-px w-full bg-border/5" />
    </div>
  )
}

function ToolMessage({ content }: { content: Array<ToolResultPart> }) {
  return (
    <div className="max-w-4xl mx-auto mb-2 px-8 opacity-90">
      <div className="px-2">
        {content.map((part, i) => (
          <ToolResultRenderer
            key={`tool-res-${part.toolCallId || i}`}
            part={part}
          />
        ))}
      </div>
      <div className="h-px w-full bg-border/5" />
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
  onRevert: (id: string) => void
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
    const { role, content } = msg
    const isLast = idx === total - 1

    switch (role) {
      case 'system':
        return (
          <SystemMessage
            content={
              typeof content === 'string' ? content : JSON.stringify(content)
            }
          />
        )
      case 'user':
        return (
          <UserMessage
            msg={msg as ChatMessage & { role: 'user' }}
            onRevert={onRevert}
          />
        )
      case 'assistant':
        return (
          <AssistantMessage
            id={msg.id}
            content={content as any}
            isLast={isLast}
            isStreaming={isStreaming}
            onCopy={onCopy}
            onOpenFile={onOpenFile}
            onRevert={onRevert}
          />
        )
      case 'tool':
        return <ToolMessage content={content as ToolResultPart[]} />
      default:
        return null
    }
  },
)

MessageItem.displayName = 'MessageItem'
