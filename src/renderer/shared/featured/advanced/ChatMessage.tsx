import {
  Bot,
  ChevronRight,
  Copy,
  FileText,
  FolderOpen,
  Save,
  Terminal,
} from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../../basic/Button'
import { Collapsible } from '../../basic/Collapsible'
import type { ChatMessage, SettingsState } from '../../lib/types'
import { cn } from '../../lib/utils'

// --- Sub-components (Merged for decoupling) ---

interface ThoughtBlockProps {
  content: string
  defaultExpanded?: boolean
}

export function ThoughtBlock({ content, defaultExpanded = false }: ThoughtBlockProps) {
  if (!content?.trim()) return null
  return (
    <Collapsible
      title="Thinking Process"
      icon={Bot}
      colorClass="border-primary/40"
      defaultExpanded={defaultExpanded}
    >
      <div className="text-[11px] leading-relaxed text-muted-foreground/80 italic whitespace-pre-wrap">
        {content}
      </div>
    </Collapsible>
  )
}

interface ThinkingProcessProps {
  content: string
  defaultOpen?: boolean
}

function ThinkingProcess({
  content,
  defaultOpen = false,
}: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="my-2">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-bold tracking-tight uppercase text-muted-foreground/50 hover:text-primary/70 transition-colors py-0.5 h-auto px-1"
      >
        <Bot size={12} className={isOpen ? 'text-primary/60' : ''} />
        <span>Thought</span>
        <ChevronRight
          size={10}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </Button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="text-[12px] leading-relaxed text-muted-foreground/80 italic bg-accent/5 px-2 py-1.5 rounded-md">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MessageContentProps {
  content?: string
  role: string
  onOpenFile?: (path: string) => void
}

function MessageContent({
  content = '',
  role,
  onOpenFile,
}: MessageContentProps) {
  if (role === 'assistant' || role === 'model') {
    const parts = []
    let currentPos = 0
    const combinedRegex =
      /<(think|thought)>([\s\S]*?)(?:<\/\1>|$)|\[\[View:(.*?)\]\]/g
    let match

    while ((match = combinedRegex.exec(content)) !== null) {
      if (match.index > currentPos) {
        parts.push(
          <Markdown key={`md-${currentPos}`} remarkPlugins={[remarkGfm]}>
            {content.substring(currentPos, match.index)}
          </Markdown>,
        )
      }

      if (match[1]) {
        parts.push(
          <ThinkingProcess
            key={`think-${match.index}`}
            content={match[2].trim()}
            defaultOpen={false}
          />,
        )
      } else if (match[3]) {
        const path = match[3]
        parts.push(
          <Button
            key={`view-${match.index}`}
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onOpenFile?.(path)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-medium transition-all my-2 group w-fit h-auto"
          >
            <FileText
              size={14}
              className="group-hover:scale-110 transition-transform"
            />
            <span>View Definition</span>
          </Button>,
        )
      }

      currentPos = combinedRegex.lastIndex
    }

    if (currentPos < content.length) {
      parts.push(
        <Markdown key={`md-${currentPos}`} remarkPlugins={[remarkGfm]}>
          {content.substring(currentPos)}
        </Markdown>,
      )
    }

    return (
      <div className="markdown-body prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
        {parts}
      </div>
    )
  }

  const parts = []
  let lastIndex = 0
  const mentionRegex = /(@file|@dir|\/skill|>cmd)\[(.*?)\]\((.*?)\)/g
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index))
    }

    const type = match[1]
    const label = match[2]
    const id = match[3]

    let className = 'mention'
    if (type === '@file') className += ' mention-file'
    else if (type === '@dir') className += ' mention-dir'
    else if (type === '/skill') className += ' mention-skill'
    else if (type === '>cmd') className += ' mention-command'

    parts.push(
      <span key={match.index} className={className} title={id}>
        {label}
      </span>,
    )

    lastIndex = mentionRegex.lastIndex
  }

  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex))
  }

  return <div className="whitespace-pre-wrap">{parts}</div>
}

export const isErrorMessage = (content: any) => {
  if (!content) return false
  const c =
    typeof content === 'string' ? content.trim() : JSON.stringify(content)
  return (
    c.startsWith('Error:') ||
    c.startsWith('Execution Error:') ||
    c.startsWith('❌') ||
    c.includes('"status": "error"')
  )
}

interface ToolCallItemProps {
  call: any
  defaultExpanded?: boolean
}

export function ToolCallItem({ call, defaultExpanded = false }: ToolCallItemProps) {
  const toolName = call.toolName || call.function?.name
  const toolArgs =
    call.args ||
    (typeof call.function?.arguments === 'string'
      ? JSON.parse(call.function.arguments)
      : call.function?.arguments)

  let Icon = Bot
  let colorClass = 'border-primary/40'

  switch (toolName) {
    case 'read_file':
      Icon = FileText
      colorClass = 'border-cyan-500/40'
      break
    case 'write_file':
      Icon = Save
      colorClass = 'border-green-500/40'
      break
    case 'list_files':
      Icon = FolderOpen
      colorClass = 'border-orange-500/40'
      break
    case 'run_command':
      Icon = Terminal
      colorClass = 'border-red-500/40'
      break
  }

  return (
    <Collapsible
      title={toolName}
      icon={Icon}
      colorClass={colorClass}
      defaultExpanded={defaultExpanded}
    >
      <pre className="text-[10px] font-mono text-muted-foreground/70 whitespace-pre-wrap overflow-auto max-h-60">
        {JSON.stringify(toolArgs, null, 2)}
      </pre>
      {call.result && (
        <div className="mt-2 border-t border-border/5 pt-2">
          <div
            className={cn(
              'text-[9px] font-bold mb-1 uppercase tracking-wider',
              isErrorMessage(call.result)
                ? 'text-destructive/60'
                : 'text-green-500/60',
            )}
          >
            {isErrorMessage(call.result) ? 'Error' : 'Result'}
          </div>
          <pre
            className={cn(
              'text-[10px] font-mono whitespace-pre-wrap max-h-96 overflow-auto opacity-90',
              isErrorMessage(call.result)
                ? 'text-destructive/80'
                : 'text-muted-foreground/60',
            )}
          >
            {typeof call.result === 'string'
              ? call.result
              : JSON.stringify(call.result, null, 2)}
          </pre>
        </div>
      )}
    </Collapsible>
  )
}

// --- Message Block Components ---

interface MessageBlockProps {
  msg: ChatMessage
  isLast: boolean
  onOpenFile: (path: string) => void
  onCopy: (content: string) => void
  settings: SettingsState
}

function SystemMessageBlock({ msg }: MessageBlockProps) {
  return (
    <Collapsible title="System Prompt" colorClass="border-muted-foreground/30">
      <div className="text-[11px] font-mono text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">
        {msg.content}
      </div>
    </Collapsible>
  )
}

function UserMessageBlock({ msg, onOpenFile }: MessageBlockProps) {
  return (
    <div className="py-0.5">
      <MessageContent content={msg.content} onOpenFile={onOpenFile} />
    </div>
  )
}

function AssistantMessageBlock({
  msg,
  isLast,
  onOpenFile,
  onCopy,
  settings,
}: MessageBlockProps) {
  const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0
  const hasContent = !!(msg.content || '')
    .replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '')
    .trim()

  return (
    <div className="space-y-1.5">
      {msg.thinking && (
        <ThoughtBlock
          content={msg.thinking}
          defaultExpanded={isLast && !hasContent && !hasToolCalls}
        />
      )}
      {[
        ...(msg.content || '').matchAll(
          /<(?:thought|think)>([\s\S]*?)<\/(?:thought|think)>/g,
        ),
      ].map((m, idx, array) => (
        <ThoughtBlock
          key={idx}
          content={m[1].trim()}
          defaultExpanded={
            isLast && !hasContent && !hasToolCalls && idx === array.length - 1
          }
        />
      ))}

      {(msg.content || '')
        .replace(/<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g, '')
        .trim() && (
        <Collapsible
          title={
            settings.agents?.list?.find(
              (a) => a.id === settings.agents?.activeId,
            )?.name || 'Assistant'
          }
          icon={null}
          colorClass="border-primary/40"
          defaultExpanded={isLast && !hasToolCalls}
          borderPosition="bottom"
        >
          <div className="py-0.5 relative group/content">
            <MessageContent
              content={msg.content
                .replace(
                  /<(?:thought|think)>[\s\S]*?<\/(?:thought|think)>/g,
                  '',
                )
                .trim()}
              onOpenFile={onOpenFile}
            />
            <div className="flex justify-end mt-2 opacity-0 group-hover/content:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                onClick={() => onCopy(msg.content || '')}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider h-auto"
                title="Copy Response"
              >
                <Copy size={12} />
                <span>Copy</span>
              </Button>
            </div>
          </div>
        </Collapsible>
      )}

      {msg.tool_calls?.map((call, idx) => (
        <ToolCallItem
          key={idx}
          call={call}
          defaultExpanded={isLast && idx === msg.tool_calls?.length - 1}
        />
      ))}
    </div>
  )
}

function ToolMessageBlock({ msg, isLast }: MessageBlockProps) {
  return (
    <Collapsible
      title={`Result: ${msg.name || 'Tool'}`}
      colorClass="border-green-500/40"
      defaultExpanded={isLast}
    >
      <pre className="text-[10px] font-mono whitespace-pre-wrap max-h-96 overflow-auto text-muted-foreground/60">
        {msg.content}
      </pre>
    </Collapsible>
  )
}

// --- Main ChatMessage Component ---

interface ChatMessageItemProps {
  msg: ChatMessage
  idx: number
  total: number
  onOpenFile: (path: string) => void
  onCopy: (content: string) => void
  settings: SettingsState
}

export function ChatMessageItem({
  msg,
  idx,
  total,
  onOpenFile,
  onCopy,
  settings,
}: ChatMessageItemProps) {
  const isLast = idx === total - 1
  const commonProps: MessageBlockProps = {
    msg,
    isLast,
    onOpenFile,
    onCopy,
    settings,
  }

  return (
    <div
      className={cn(
        'group/msg relative transition-all duration-300 max-w-4xl mx-auto py-1 rounded-sm border border-transparent',
        msg.role === 'user' ? 'bg-foreground/[0.03] border-border/5 px-4' : '',
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="text-foreground text-sm leading-relaxed">
          {msg.role === 'system' && <SystemMessageBlock {...commonProps} />}
          {msg.role === 'user' && <UserMessageBlock {...commonProps} />}
          {(msg.role === 'assistant' || msg.role === 'model') && (
            <AssistantMessageBlock {...commonProps} />
          )}
          {msg.role === 'tool' && <ToolMessageBlock {...commonProps} />}

          {/* Fallback for unknown roles */}
          {!['system', 'user', 'assistant', 'model', 'tool'].includes(
            msg.role,
          ) && (
            <div className="py-0.5">
              <MessageContent
                content={msg.content}
                role={msg.role}
                onOpenFile={onOpenFile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
