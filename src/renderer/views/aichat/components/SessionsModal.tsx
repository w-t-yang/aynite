import { Calendar, Clock, History, X } from 'lucide-react'
import { FLEX_CENTER_GAP_3 } from '../../../../lib/constants/renderer/styles'
import { Button } from '../../../shared/basic/Button'

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
    title?: string
  }[]
  onSelect: (id: string, date: string) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-300">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="p-2 h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </Button>
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
              <Button
                variant="ghost"
                key={s.id}
                onClick={() => {
                  onSelect(s.id, s.date)
                  onClose()
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-accent/50 border border-transparent hover:border-border/30 transition-all group flex gap-4 items-start h-auto"
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
                      {s.title || `Session ${s.id.slice(-6)}`}
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
              </Button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
