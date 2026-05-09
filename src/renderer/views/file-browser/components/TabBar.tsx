import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../../../shared/basic/Button'
import { SelectionMenu } from '../../../shared/featured/SelectionMenu'
import { cn } from '../../../shared/lib/utils'

interface Tab {
  name: string
  path: string
}

interface TabBarProps {
  tabs: Tab[]
  activePath: string | null
  dirtyPaths?: Set<string>
  onTabSelect: (path: string) => void
  onTabClose: (path: string) => void
  onCloseAll: () => void
}

export function TabBar({
  tabs,
  activePath,
  dirtyPaths = new Set(),
  onTabSelect,
  onTabClose,
  onCloseAll,
}: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const _scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -200 : 200
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
    }
  }

  const handleMenuSelect = (id: string) => {
    if (id === 'close-all') {
      onCloseAll()
    } else if (id === 'prev') {
      const currentIndex = tabs.findIndex((t) => t.path === activePath)
      if (currentIndex > 0) {
        onTabSelect(tabs[currentIndex - 1].path)
      }
    } else if (id === 'next') {
      const currentIndex = tabs.findIndex((t) => t.path === activePath)
      if (currentIndex >= 0 && currentIndex < tabs.length - 1) {
        onTabSelect(tabs[currentIndex + 1].path)
      }
    }
  }

  const menuItems = [
    { id: 'prev', label: 'Previous Tab', icon: <ChevronLeft size={14} /> },
    { id: 'next', label: 'Next Tab', icon: <ChevronRight size={14} /> },
    { id: 'divider-1', type: 'divider' },
    {
      id: 'close-all',
      label: 'Close All Tabs',
      icon: <X size={14} />,
      className: 'text-destructive',
    },
  ]

  // Ensure active tab is visible
  useEffect(() => {
    if (activePath && scrollRef.current) {
      const activeTabEl = scrollRef.current.querySelector(
        '[aria-selected="true"]',
      )
      if (activeTabEl) {
        activeTabEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        })
      }
    }
  }, [activePath])

  return (
    <div className="h-10 shrink-0 bg-sidebar border-b border-border flex items-center">
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
              {dirtyPaths.has(tab.path) && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 ml-2 shrink-0 animate-pulse" />
              )}
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

      {/* Tab Menu */}
      <div className="px-2 border-l border-border h-full flex items-center bg-sidebar">
        <SelectionMenu
          items={menuItems}
          onSelect={handleMenuSelect}
          align="right"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded hover:bg-accent/50 transition-colors"
              title="Tab options"
            >
              <Menu size={16} />
            </Button>
          }
        />
      </div>
    </div>
  )
}
