import { Copy, Cpu, History, Plus, User } from 'lucide-react'
import { Button } from '../../../shared/basic/Button'
import { SelectionMenu } from '../../../shared/featured/SelectionMenu'
import type { SettingsState } from '../../../shared/lib/types'

interface HeaderProps {
  settings: SettingsState
  onShowHistory: () => void
  onClear: () => void
  onCopy: () => void
  onSwitchAgent: (id: string) => void
  onSwitchProvider: (id: string) => void
}

export function Header({
  settings,
  onShowHistory,
  onClear,
  onCopy,
  onSwitchAgent,
  onSwitchProvider,
}: HeaderProps) {
  const activeAgent = settings.agents?.list?.find(
    (a) => a.id === settings.agents?.activeId,
  )
  const agentName = activeAgent?.name || 'Assistant'

  const activeProvider = settings.ai?.providers?.find(
    (p) => p.id === settings.ai?.activeId,
  )
  const modelName = activeProvider?.model || 'No Model'

  const agentItems = (settings.agents?.list || []).map((a) => ({
    id: a.id,
    label: a.name,
    icon: <User size={14} />,
    isActive: a.id === settings.agents?.activeId,
  }))

  const providerItems = (settings.ai?.providers || []).map((p) => ({
    id: p.id,
    label: p.model,
    subtitle: p.provider,
    icon: <Cpu size={14} />,
    isActive: p.id === settings.ai?.activeId,
  }))

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border/10 bg-background/40 backdrop-blur-md z-layout relative">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest">
          <SelectionMenu
            items={agentItems}
            activeId={settings.agents?.activeId}
            onSelect={onSwitchAgent}
            trigger={
              <Button
                variant="ghost"
                className="hover:text-primary transition-colors focus:outline-none p-0 h-auto font-bold uppercase tracking-widest text-[12px] hover:bg-transparent"
              >
                {agentName}
              </Button>
            }
            title="Switch Agent"
          />
          <span className="text-muted-foreground/20 font-normal select-none">
            /
          </span>
          <SelectionMenu
            items={providerItems}
            activeId={settings.ai?.activeId}
            onSelect={onSwitchProvider}
            trigger={
              <Button
                variant="ghost"
                className="text-muted-foreground/60 hover:text-primary transition-colors focus:outline-none p-0 h-auto font-bold uppercase tracking-widest text-[12px] hover:bg-transparent"
              >
                {modelName}
              </Button>
            }
            title="Switch Model"
          />
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
