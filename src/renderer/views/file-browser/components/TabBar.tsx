import {
  ChevronLeft,
  ChevronRight,
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  Menu,
  X,
} from 'lucide-react'
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

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'json':
      return <FileJson size={13} />
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'css':
    case 'html':
    case 'xml':
      return <FileCode size={13} />
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <FileImage size={13} />
    case 'md':
    case 'txt':
    case 'log':
      return <FileText size={13} />
    default:
      return <File size={13} />
  }
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
    <div className="h-9 shrink-0 bg-muted/30 border-b border-border flex items-center select-none">
      {/* Tabs Area */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center h-full overflow-x-auto scrollbar-hide no-scrollbar"
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
                'group relative h-full flex items-center gap-1.5 px-3 cursor-pointer transition-all duration-150 outline-none',
                'min-w-0 max-w-[180px]',
                isActive
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground/70 hover:text-foreground hover:bg-background/40',
              )}
            >
              {/* Right separator line (hide for active tab) */}
              {!isActive && (
                <div className="absolute right-0 top-[20%] h-[60%] w-px bg-border/40" />
              )}

              <span className="shrink-0 opacity-60">
                {getFileIcon(tab.name)}
              </span>

              <span className="flex-1 truncate text-xs font-medium">
                {tab.name}
              </span>

              {dirtyPaths.has(tab.path) && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 animate-pulse" />
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.path)
                }}
                className={cn(
                  'h-[18px] w-[18px] p-0 rounded-sm transition-all duration-150',
                  'hover:bg-muted-foreground/10 hover:text-foreground',
                  isActive
                    ? 'opacity-60 hover:opacity-100'
                    : 'opacity-0 group-hover:opacity-40 hover:group-hover:opacity-100',
                )}
              >
                <X size={11} />
              </Button>

              {/* Active tab bottom border — extends full width with no gap */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-px bg-background" />
              )}
            </div>
          )
        })}
      </div>

      {/* Tab Menu */}
      <div className="px-1.5 h-full flex items-center">
        <SelectionMenu
          items={menuItems}
          onSelect={handleMenuSelect}
          align="right"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md hover:bg-accent/40 transition-colors text-muted-foreground/50 hover:text-foreground"
              title="Tab options"
            >
              <Menu size={14} />
            </Button>
          }
        />
      </div>
    </div>
  )
}
