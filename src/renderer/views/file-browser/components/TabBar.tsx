import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '../../../shared/basic/Button'
import { cn } from '../../../shared/lib/utils'

interface Tab {
  name: string
  path: string
}

interface TabBarProps {
  tabs: Tab[]
  activePath: string | null
  onTabSelect: (path: string) => void
  onTabClose: (path: string) => void
  onCloseAll: () => void
}

export function TabBar({
  tabs,
  activePath,
  onTabSelect,
  onTabClose,
  onCloseAll,
}: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -200 : 200
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
    }
  }

  return (
    <div className="h-10 shrink-0 bg-sidebar border-b border-border flex items-center overflow-hidden">
      {/* Tabs Area */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center h-full overflow-x-auto scrollbar-hide no-scrollbar select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = tab.path === activePath
          return (
            <div
              key={tab.path}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              onClick={() => onTabSelect(tab.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onTabSelect(tab.path)
                }
              }}
              className={cn(
                'group h-full min-w-[120px] max-w-[200px] flex items-center px-3 border-r border-border cursor-pointer transition-colors relative outline-none focus:bg-accent/30',
                isActive
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <span className="flex-1 truncate text-xs font-medium">
                {tab.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.path)
                }}
                className={cn(
                  'ml-2 h-5 w-5 p-0.5 rounded-sm hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity',
                  isActive && 'opacity-100',
                )}
              >
                <X size={12} />
              </Button>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-0.5 px-2 bg-sidebar border-l border-border h-full shadow-[-4px_0_8px_rgba(0,0,0,0.1)]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => scroll('left')}
          className="h-7 w-7 rounded"
          title="Scroll tabs left"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => scroll('right')}
          className="h-7 w-7 rounded"
          title="Scroll tabs right"
        >
          <ChevronRight size={16} />
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onCloseAll}
          className="h-7 w-7 rounded hover:text-destructive transition-colors"
          title="Close all tabs"
        >
          <X size={16} />
        </Button>
      </div>
    </div>
  )
}
