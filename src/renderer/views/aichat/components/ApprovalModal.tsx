import { AlertTriangle, Check, Folder, Terminal, X } from 'lucide-react'
import { Button } from '../../../shared/basic/Button'

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
    <div className="relative group/approval overflow-hidden rounded-md border border-warning/30 bg-warning/5 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 mb-3 px-6 py-4 mx-4">
      <div className="relative space-y-3">
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
          <Button
            onClick={onApprove}
            className="flex-1 h-8 bg-warning text-warning-foreground hover:bg-warning/90 transition-all active:scale-[0.98] font-bold text-[10px] uppercase tracking-widest shadow shadow-warning/10 flex items-center justify-center gap-1.5 group/btn rounded"
          >
            <Check
              size={12}
              className="group-hover/btn:scale-110 transition-transform"
            />
            Approve
          </Button>
          <Button
            variant="ghost"
            onClick={onReject}
            className="flex-1 h-8 bg-muted/30 border border-border/20 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-[0.98] font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 group/btn rounded"
          >
            <X
              size={12}
              className="group-hover/btn:scale-110 transition-transform"
            />
            Reject
          </Button>
        </div>
      </div>
    </div>
  )
}
