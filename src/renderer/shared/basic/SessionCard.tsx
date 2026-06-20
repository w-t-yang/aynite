import { Bot, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '../lib/utils'

export interface SessionEntry {
  id: string
  date: string
  lastModified: string
  title: string
  preview: string
  messageCount: number
}

interface SessionCardProps {
  session: SessionEntry
  isActive?: boolean
  onClick?: () => void
  onDelete?: (e: React.MouseEvent) => void
}

/** Extract the agent name from the session title.
 *  The server returns "AgentName - ModelName" when metadata exists,
 *  or "Session XXXXXX" as fallback.
 *  Returns "Aynite" as default fallback. */
function getAgentName(session: SessionEntry): string {
  if (session.title && !session.title.startsWith('Session ')) {
    const parts = session.title.split(' - ')
    return parts[0] || session.title
  }
  return 'Aynite'
}

export function SessionCard({
  session,
  isActive,
  onClick,
  onDelete,
}: SessionCardProps) {
  const dateLabel = useMemo(() => {
    const d = new Date(session.lastModified)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }, [session.lastModified])

  const agentName = useMemo(() => getAgentName(session), [session])

  const card = (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        isActive
          ? 'border-primary bg-primary/[0.03]'
          : 'border-border bg-accent/5 hover:border-border/60',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Bot size={14} className="text-primary shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider truncate">
          {agentName}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
            title="Delete session"
          >
            <Trash2
              size={12}
              className="text-muted-foreground/40 hover:text-destructive transition-colors"
            />
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
        {session.preview}
      </p>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
        <span>{dateLabel}</span>
        <span>{session.messageCount} messages</span>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left group"
      >
        {card}
      </button>
    )
  }

  return card
}
