import { Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '../lib/utils'

export interface SessionEntry {
  id: string
  date: string
  lastModified: string
  title: string
  preview: string
  messageCount: number
  contextSize?: number
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

function formatContextSize(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`
  return `${tokens}`
}

export function SessionCard({
  session,
  isActive,
  onClick,
  onDelete,
}: SessionCardProps) {
  const dateLabel = useMemo(() => {
    const d = new Date(session.lastModified)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
  }, [session.lastModified])

  const agentName = useMemo(() => getAgentName(session), [session])

  const contextLabel = useMemo(() => {
    if (session.contextSize !== undefined) {
      return `${formatContextSize(session.contextSize)} Tokens`
    }
    return ''
  }, [session.contextSize])

  const card = (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        isActive
          ? 'border-primary bg-primary/[0.03]'
          : 'border-border bg-accent/5 hover:border-border/60',
      )}
    >
      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-2">
        {session.preview}
      </p>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
        <span className="truncate min-w-0">
          {dateLabel} with {agentName}
        </span>
        {contextLabel ? (
          <span className="shrink-0 ml-auto flex items-center gap-1">
            <span>{contextLabel}</span>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                title="Delete session"
              >
                <Trash2
                  size={12}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors"
                />
              </button>
            )}
          </span>
        ) : onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
            title="Delete session"
          >
            <Trash2
              size={12}
              className="text-muted-foreground/40 hover:text-destructive transition-colors"
            />
          </button>
        ) : null}
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
