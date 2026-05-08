import { History, LayoutGrid, MoreHorizontal, Sparkles } from 'lucide-react'
import { Button } from '../../../shared/basic/Button'
import type { SettingsState } from '../../../shared/lib/types'

interface HeaderProps {
  settings: SettingsState
  onShowHistory: () => void
  onClear: () => void
}

export function Header({ settings, onShowHistory, onClear }: HeaderProps) {
  const activeAgent = settings.agents?.list?.find(
    (a) => a.id === settings.agents?.activeId,
  )
  const agentName = activeAgent?.name || 'Assistant'
  const agentDescription = activeAgent?.description || 'AI Pair Programmer'

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-background/40 backdrop-blur-md z-20 relative">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/5 border border-primary/20 group hover:scale-105 transition-transform duration-300">
          <Sparkles
            size={20}
            className="group-hover:rotate-12 transition-transform"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-foreground/90">
              {agentName}
            </h2>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
          </div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tight">
            {agentDescription}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowHistory}
          className="w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground transition-all active:scale-95"
          title="Session History"
        >
          <History size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground transition-all active:scale-95"
          title="Clear Chat"
        >
          <LayoutGrid size={16} className="rotate-45" />
        </Button>
        <div className="w-[1px] h-4 bg-border/20 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground transition-all active:scale-95"
        >
          <MoreHorizontal size={16} />
        </Button>
      </div>
    </div>
  )
}
