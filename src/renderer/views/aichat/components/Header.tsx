import { Copy, History, Plus } from 'lucide-react'
import { Button } from '../../../shared/basic/Button'
import type { SettingsState } from '../../../shared/lib/types'

interface HeaderProps {
  settings: SettingsState
  onShowHistory: () => void
  onClear: () => void
  onCopy: () => void
}

export function Header({
  settings,
  onShowHistory,
  onClear,
  onCopy,
}: HeaderProps) {
  const activeAgent = settings.agents?.list?.find(
    (a) => a.id === settings.agents?.activeId,
  )
  const agentName = activeAgent?.name || 'Assistant'
  const activeProvider = settings.ai?.providers?.find(
    (p) => p.id === settings.ai?.activeId,
  )
  const providerLabel = activeProvider
    ? `${activeProvider.provider}/${activeProvider.model}`
    : 'No AI Provider Selected'

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-background/40 backdrop-blur-md z-layout relative">
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold uppercase tracking-widest text-foreground/90">
              {agentName}
            </h2>
          </div>
          <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-tight">
            {providerLabel}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground transition-all active:scale-95"
          title="New Session"
        >
          <Plus size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onShowHistory}
          className="w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground transition-all active:scale-95"
          title="Load Session"
        >
          <History size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCopy}
          className="w-8 h-8 rounded-lg hover:bg-accent text-muted-foreground transition-all active:scale-95"
          title="Copy Session"
        >
          <Copy size={16} />
        </Button>
      </div>
    </div>
  )
}
