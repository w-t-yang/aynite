import {
  AlertTriangle,
  Bot,
  Calendar,
  Check,
  Clock,
  Folder,
  History,
  Terminal,
  X,
  XCircle,
} from 'lucide-react'
import { Collapsible } from '../../shared/basic/Collapsible'
import { cn } from '../../shared/lib/utils'
import { FLEX_CENTER_GAP_2, FLEX_CENTER_GAP_3 } from '../../shared/lib/styles'
import {
  isErrorMessage,
  ThoughtBlock,
  ToolCallItem,
} from '../../shared/featured/advanced/ChatMessage'

// ─── Tool Result Message Component ──────────────────────────────────────────

export function ToolResultMessage({
  name,
  content,
  defaultExpanded = false,
}: {
  name?: string
  content: string
  defaultExpanded?: boolean
}) {
  const isError = isErrorMessage(content)
  return (
    <Collapsible
      title={isError ? `Error: ${name}` : `Result: ${name}`}
      icon={isError ? XCircle : Check}
      colorClass={isError ? 'border-destructive/40' : 'border-green-500/40'}
      defaultExpanded={defaultExpanded}
    >
      <pre
        className={cn(
          'text-[10px] font-mono whitespace-pre-wrap max-h-96 overflow-auto',
          isError ? 'text-destructive/80' : 'text-muted-foreground/60',
        )}
      >
        {content}
      </pre>
    </Collapsible>
  )
}

// ─── Command Approval Modal ─────────────────────────────────────────────────

export function ApprovalModal({
  command,
  cwd,
  onApprove,
  onReject,
}: {
  command: string
  cwd: string
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div className="relative group/approval my-2 overflow-hidden rounded-md border border-warning/30 bg-warning/5 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-warning/5 via-transparent to-transparent opacity-30" />

      <div className="relative p-3 space-y-3">
        <div className="flex items-center gap-2 text-warning">
          <div className="w-6 h-6 rounded bg-warning/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={12} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
            Command Approval
          </span>
        </div>

        <div className="bg-background/40 border border-border/30 rounded px-2 py-1.5 shadow-inner">
          <div className="flex items-start gap-2">
            <Terminal
              size={12}
              className="text-muted-foreground mt-0.5 shrink-0"
            />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <code className="text-xs text-foreground font-mono break-all leading-normal bg-accent/5 px-1.5 py-0.5 rounded border border-border/10 whitespace-pre-wrap">
                {command}
              </code>
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60 font-medium">
                <Folder size={8} />
                <span className="truncate">{cwd}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onApprove}
            className="flex-1 h-8 rounded bg-warning text-warning-foreground hover:bg-warning/90 transition-all active:scale-[0.98] font-bold text-[10px] uppercase tracking-widest shadow shadow-warning/10 flex items-center justify-center gap-1.5 group/btn"
          >
            <Check
              size={12}
              className="group-hover/btn:scale-110 transition-transform"
            />
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex-1 h-8 rounded bg-muted/30 border border-border/20 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-[0.98] font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 group/btn"
          >
            <X
              size={12}
              className="group-hover/btn:scale-110 transition-transform"
            />
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sessions Modal ─────────────────────────────────────────────────────────

export function SessionsModal({
  sessions,
  onSelect,
  onClose,
}: {
  sessions: {
    id: string
    date: string
    lastModified: string
    preview: string
  }[]
  onSelect: (id: string, date: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-3xl bg-background border border-border/50 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className={FLEX_CENTER_GAP_3}>
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest">
                Chat Sessions
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight opacity-70">
                Historical sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground opacity-50 flex flex-col items-center gap-4">
              <History size={40} strokeWidth={1} />
              <p className="text-xs uppercase tracking-widest font-bold">
                No sessions found
              </p>
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSelect(s.id, s.date)
                  onClose()
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border/30 transition-all group flex gap-4 items-start"
              >
                <div className="shrink-0 mt-1">
                  <div className="w-8 h-8 rounded bg-muted flex flex-col items-center justify-center text-[8px] font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                    <Calendar size={10} className="mb-0.5" />
                    {s.date.split('-').slice(1).join('/')}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-foreground/80 group-hover:text-primary transition-colors uppercase tracking-tight">
                      Session {s.id.slice(-6)}
                    </span>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60 font-medium">
                      <Clock size={10} />
                      {new Date(s.lastModified).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <p className="text-[12px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                    {s.preview || 'No content'}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
