import {
  ChevronLeft,
  ChevronRight,
  File,
  FileCode,
  FileImage,
  FileJson,
  FileText,
  Grid3X3,
  List,
  Menu,
  X,
} from 'lucide-react'
import { Button } from '../../../shared/basic/Button'
import type { SelectionItem } from '../../../shared/basic/SelectionList'
import { SelectionMenu } from '../../../shared/featured/SelectionMenu'
import { cn } from '../../../shared/lib/utils'

interface Tab {
  name: string
  path: string
}

interface BreadcrumbSegment {
  label: string
  path: string
}

interface FinderBarProps {
  tabs: Tab[]
  activePath: string | null
  breadcrumbSegments: BreadcrumbSegment[]
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onTabSelect: (path: string) => void
  onFolderBrowse: (path: string) => void
  onTabClose: (path: string) => void
  onCloseAll: () => void
  onSwitchToTabMode: () => void
  t?: (key: string) => string
}

function _getFileIcon(name: string) {
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

export function FinderBar({
  tabs,
  activePath,
  breadcrumbSegments,
  viewMode,
  onViewModeChange,
  onTabSelect,
  onFolderBrowse,
  onTabClose: _onTabClose,
  onCloseAll,
  onSwitchToTabMode,
  t: tProp,
}: FinderBarProps) {
  const t = tProp || ((key: string) => key)

  const handleMenuSelect = (id: string) => {
    if (id === 'close-all') {
      onCloseAll()
    } else if (id === 'switch-to-tab-mode') {
      onSwitchToTabMode()
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

  const menuItems: SelectionItem[] = [
    { id: 'prev', label: t('tab.prevTab'), icon: <ChevronLeft size={14} /> },
    { id: 'next', label: t('tab.nextTab'), icon: <ChevronRight size={14} /> },
    { id: 'divider-1', type: 'divider' },
    {
      id: 'switch-to-tab-mode',
      label: 'Tab Mode',
      icon: <List size={14} />,
    },
    { id: 'divider-2', type: 'divider' },
    {
      id: 'close-all',
      label: t('tab.closeAll'),
      icon: <X size={14} />,
      className: 'text-destructive',
    },
  ]

  // The last segment is the file itself — we only want folders as clickable
  const _folderSegments = breadcrumbSegments.slice(0, -1)

  return (
    <div className="h-9 shrink-0 bg-muted/30 border-b border-border flex items-center select-none">
      {/* Left: Grid/List toggle */}
      <div className="flex items-center gap-0.5 px-1.5 h-full">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewModeChange('grid')}
          className={cn(
            'h-6 w-6 rounded-md transition-colors',
            viewMode === 'grid'
              ? 'text-foreground bg-accent/30'
              : 'text-muted-foreground/40 hover:text-muted-foreground/70',
          )}
          title="Grid view"
        >
          <Grid3X3 size={13} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onViewModeChange('list')}
          className={cn(
            'h-6 w-6 rounded-md transition-colors',
            viewMode === 'list'
              ? 'text-foreground bg-accent/30'
              : 'text-muted-foreground/40 hover:text-muted-foreground/70',
          )}
          title="List view"
        >
          <List size={13} />
        </Button>
      </div>

      {/* Breadcrumb path */}
      <div className="flex-1 flex items-center h-full min-w-0 overflow-x-auto scrollbar-hide no-scrollbar px-1 gap-0.5">
        {breadcrumbSegments.length > 0 ? (
          breadcrumbSegments.map((seg, i) => {
            const isLast = i === breadcrumbSegments.length - 1
            const isFile = isLast
            return (
              <span
                key={seg.path}
                className="flex items-center gap-0.5 shrink-0"
              >
                {i > 0 && (
                  <span className="text-muted-foreground/20 mx-0.5 text-[10px]">
                    /
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isFile) return // clicking the file itself does nothing
                    onFolderBrowse(seg.path)
                  }}
                  className={cn(
                    'text-[11px] font-mono px-1 py-0.5 rounded transition-colors',
                    isFile
                      ? 'text-foreground/60 cursor-default'
                      : 'text-muted-foreground/70 hover:text-foreground hover:bg-accent/20 cursor-pointer',
                  )}
                  title={seg.path}
                >
                  {seg.label}
                </button>
              </span>
            )
          })
        ) : (
          <span className="text-xs text-muted-foreground/30 italic px-2">
            No file open
          </span>
        )}
      </div>

      {/* Right: Menu */}
      <div className="px-1.5 h-full flex items-center shrink-0">
        <SelectionMenu
          items={menuItems}
          onSelect={handleMenuSelect}
          align="right"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md hover:bg-accent/40 transition-colors text-muted-foreground/50 hover:text-foreground"
              title="Options"
            >
              <Menu size={14} />
            </Button>
          }
        />
      </div>
    </div>
  )
}
