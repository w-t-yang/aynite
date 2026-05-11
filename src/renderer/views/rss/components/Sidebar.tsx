import {
  Bookmark,
  ExternalLink,
  FolderPlus,
  Globe,
  Plus,
  Rss,
  Trash2,
} from 'lucide-react'
import { Button } from '../../../shared/basic/Button'
import { cn } from '../../../shared/lib/utils'
import type { RssConfig, RssContentStore, ViewMode } from '../types'

interface SidebarProps {
  config: RssConfig
  contents: Record<string, RssContentStore>
  selectedSourceId: string | null
  view: ViewMode
  width: number
  onSelectSource: (sourceId: string | null) => void
  onViewChange: (view: ViewMode) => void
  onAddGroup: () => void
  onAddSource: () => void
  onDeleteGroup: (groupId: string) => void
  onDeleteSource: (sourceId: string) => void
  onEditSource: (sourceId: string) => void
}

function getUnreadCount(
  contents: Record<string, RssContentStore>,
  sourceId: string,
): number {
  const store = contents[sourceId]
  if (!store) return 0
  return store.items.filter((i) => !i.isRead).length
}

export function Sidebar({
  config,
  contents,
  selectedSourceId,
  view,
  width,
  onSelectSource,
  onViewChange,
  onAddGroup,
  onAddSource,
  onDeleteGroup,
  onDeleteSource,
  onEditSource,
}: SidebarProps) {
  // Group sources by groupId
  const groupedSources = new Map<string, typeof config.sources>()
  for (const source of config.sources) {
    const list = groupedSources.get(source.groupId) || []
    list.push(source)
    groupedSources.set(source.groupId, list)
  }

  return (
    <div
      className="shrink-0 border-r border-border flex flex-col bg-sidebar/50"
      style={{ width }}
    >
      {/* View mode toggles */}
      <div className="flex items-center gap-1 p-2 border-b border-border/40">
        <button
          type="button"
          onClick={() => onViewChange('all')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors',
            view === 'all'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <Globe size={12} />
          All
        </button>
        <button
          type="button"
          onClick={() => onViewChange('bookmarks')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-md transition-colors',
            view === 'bookmarks'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <Bookmark size={12} />
          Saved
        </button>
      </div>

      {/* Add Feed button */}
      <div className="p-2 border-b border-border/40">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddSource}
          className="w-full text-xs gap-1"
        >
          <Plus size={12} /> Add Feed
        </Button>
      </div>

      {/* Groups & Sources */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {config.groups.length === 0 && config.sources.length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-xs">
            No feeds yet. Add a feed to get started.
          </div>
        )}

        {config.groups.map((group) => {
          const sources = groupedSources.get(group.id) || []
          return (
            <div key={group.id}>
              {/* Group header */}
              <div className="flex items-center justify-between px-3 py-1.5 group">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group.name}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddSource()
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-0.5"
                    title="Add feed to this group"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteGroup(group.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                    title="Delete group"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>

              {/* Sources in group */}
              {sources.map((source) => {
                const unread = getUnreadCount(contents, source.id)
                const isSelected = selectedSourceId === source.id
                return (
                  // biome-ignore lint/a11y/noStaticElementInteractions: clickable source item, consistent with other views
                  <div
                    key={source.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer group hover:bg-accent/30 transition-colors',
                      isSelected && 'bg-accent text-accent-foreground',
                      !isSelected &&
                        'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => onSelectSource(source.id)}
                    onKeyDown={() => {}}
                  >
                    <Rss
                      size={12}
                      className={cn(
                        'shrink-0',
                        source.error ? 'text-destructive' : 'text-primary/60',
                      )}
                    />
                    <span className="flex-1 truncate">
                      {source.title ||
                        source.url.replace(/^https?:\/\//, '').split('/')[0]}
                    </span>

                    {unread > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {unread}
                      </span>
                    )}

                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditSource(source.id)
                        }}
                        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit source"
                      >
                        <ExternalLink size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSource(source.id)
                        }}
                        className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete source"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                )
              })}

              {sources.length === 0 && (
                <div className="px-3 py-1 text-[10px] text-muted-foreground/40 italic">
                  No feeds in this group
                </div>
              )}
            </div>
          )
        })}

        {/* Orphaned sources (no group, shouldn't happen but handle gracefully) */}
        {(() => {
          const orphaned = config.sources.filter(
            (s) => !config.groups.find((g) => g.id === s.groupId),
          )
          if (orphaned.length === 0) return null
          return (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Uncategorized
              </div>
              {orphaned.map((source) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: clickable source item
                <div
                  key={source.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-accent/30 transition-colors',
                    selectedSourceId === source.id &&
                      'bg-accent text-accent-foreground',
                  )}
                  onClick={() => onSelectSource(source.id)}
                  onKeyDown={() => {}}
                >
                  <Rss size={12} className="text-primary/60 shrink-0" />
                  <span className="flex-1 truncate">
                    {source.title || source.url}
                  </span>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* New Group button */}
      <div className="p-2 border-t border-border/40">
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddGroup}
          className="w-full text-xs gap-1 text-muted-foreground"
        >
          <FolderPlus size={12} /> New Group
        </Button>
      </div>
    </div>
  )
}
