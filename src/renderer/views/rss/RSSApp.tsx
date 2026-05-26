import { Loader2, RefreshCw, Rss } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppEvent } from '../ViewContext'
import { AddGroupModal } from './components/AddGroupModal'
import { AddSourceModal } from './components/AddSourceModal'
import { ArticleDetail } from './components/ArticleDetail'
import { ArticleList } from './components/ArticleList'
import { EditSourceModal } from './components/EditSourceModal'
import { Sidebar } from './components/Sidebar'
import { useRSS } from './hooks/useRSS'
import type { RssSource, ViewMode } from './types'

const MIN_SIDEBAR_WIDTH = 140
const MAX_SIDEBAR_WIDTH = 400
const MIN_ARTICLE_LIST_WIDTH = 200

export function RSSApp() {
  const rss = useRSS()

  const [view, setView] = useState<ViewMode>('all')
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showAddSource, setShowAddSource] = useState(false)
  const [editingSource, setEditingSource] = useState<RssSource | null>(null)

  // Panel resize state — synced from rss.panelWidths after loading
  const [sidebarWidth, setSidebarWidth] = useState(rss.panelWidths.sidebar)
  const [articleListWidth, setArticleListWidth] = useState(
    rss.panelWidths.articleList,
  )

  useEffect(() => {
    if (!rss.loading) {
      setSidebarWidth(rss.panelWidths.sidebar)
      setArticleListWidth(rss.panelWidths.articleList)
    }
  }, [rss.loading, rss.panelWidths.sidebar, rss.panelWidths.articleList])

  // Refs for live resize values
  const sidebarWidthRef = useRef(sidebarWidth)
  sidebarWidthRef.current = sidebarWidth
  const articleListWidthRef = useRef(articleListWidth)
  articleListWidthRef.current = articleListWidth

  // Reload data on theme changes
  useAppEvent(
    'theme-changed',
    useCallback(() => {}, []),
  )

  const handleSelectSource = useCallback(
    (sourceId: string | null) => {
      setView('all')
      rss.selectSource(sourceId)
      rss.selectItem(null)
    },
    [rss],
  )

  const handleSelectToday = useCallback(() => {
    setView('all')
    rss.selectSource('__today__')
    rss.selectItem(null)
  }, [rss])

  const handleSelectItem = useCallback(
    (itemId: string) => {
      rss.selectItem(itemId)
      rss.markRead(itemId)
    },
    [rss],
  )

  const handleViewChange = useCallback(
    (newView: ViewMode) => {
      setView(newView)
      // Clear source selection when switching to bookmarks
      if (newView === 'bookmarks') {
        rss.selectSource(null)
      } else {
        // Switching back to 'all' — keep current source selection
      }
      rss.selectItem(null)
    },
    [rss],
  )

  const handleMarkAllRead = useCallback(() => {
    const sourceId = rss.selectedSourceId || '__today__'
    rss.markAllRead(sourceId)
  }, [rss])

  const handleOpenExternal = useCallback((url: string) => {
    window.aynite.openExternal(url)
  }, [])

  const handleToggleBookmark = useCallback(() => {
    const item = rss.getSelectedItem()
    if (item) rss.toggleBookmark(item)
  }, [rss])

  const handleAddGroup = useCallback(
    (name: string) => {
      rss.addGroup(name)
      setShowAddGroup(false)
    },
    [rss],
  )

  const handleAddSource = useCallback(
    (url: string, groupId: string) => {
      rss.addSource(url, groupId)
      setShowAddSource(false)
    },
    [rss],
  )

  const handleEditSource = useCallback(
    (sourceId: string, updates: { url: string; groupId: string }) => {
      rss.updateSource(sourceId, updates)
      setEditingSource(null)
    },
    [rss],
  )

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      rss.deleteGroup(groupId)
    },
    [rss],
  )

  const handleDeleteSource = useCallback(
    (sourceId: string) => {
      rss.deleteSource(sourceId)
    },
    [rss],
  )

  // ─── Resize handlers ──────────────────────────────────────────────────

  const startSidebarResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidthRef.current
      let finalDelta = 0

      const onMouseMove = (moveEvent: MouseEvent) => {
        finalDelta = moveEvent.clientX - startX
        setSidebarWidth(
          Math.min(
            MAX_SIDEBAR_WIDTH,
            Math.max(MIN_SIDEBAR_WIDTH, startWidth + finalDelta),
          ),
        )
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        const finalWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, startWidth + finalDelta),
        )
        setSidebarWidth(finalWidth)
        rss.savePanelWidths(finalWidth, articleListWidthRef.current)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [rss],
  )

  const startArticleListResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = articleListWidthRef.current
      let finalDelta = 0

      const onMouseMove = (moveEvent: MouseEvent) => {
        finalDelta = moveEvent.clientX - startX
        setArticleListWidth(
          Math.max(MIN_ARTICLE_LIST_WIDTH, startWidth + finalDelta),
        )
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        const finalWidth = Math.max(
          MIN_ARTICLE_LIST_WIDTH,
          startWidth + finalDelta,
        )
        setArticleListWidth(finalWidth)
        rss.savePanelWidths(sidebarWidthRef.current, finalWidth)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [rss],
  )

  // Determine which items to show based on view mode and selection
  const currentItems =
    view === 'bookmarks' ? rss.getBookmarkedItems() : rss.getCurrentItems()
  const selectedItem = rss.getSelectedItem()
  const isItemBookmarked = selectedItem
    ? !!rss.bookmarks[selectedItem.id]
    : false
  const sourceTitle =
    rss.selectedSourceId && rss.selectedSourceId !== '__today__'
      ? rss.config?.sources.find((s: any) => s.id === rss.selectedSourceId)
          ?.title
      : rss.selectedSourceId === '__today__'
        ? 'Today'
        : undefined

  // Determine if we should show date grouping and source badges
  const isSingleFeed =
    rss.selectedSourceId !== null &&
    rss.selectedSourceId !== '__today__' &&
    view !== 'bookmarks'
  const showSourceBadge =
    rss.selectedSourceId === null || rss.selectedSourceId === '__today__'

  if (rss.loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 bg-muted/30 justify-between shrink-0 relative z-popover">
        <div className="flex items-center gap-2 min-w-0">
          <Rss size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest truncate text-muted-foreground">
            RSS Reader
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={rss.fetchAll}
            disabled={rss.fetching}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-30"
            title="Refresh all feeds"
          >
            <RefreshCw
              size={14}
              className={rss.fetching ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          config={rss.config || { groups: [], sources: [] }}
          contents={rss.contents}
          selectedSourceId={rss.selectedSourceId}
          view={view}
          width={sidebarWidth}
          onSelectSource={handleSelectSource}
          onSelectToday={handleSelectToday}
          onViewChange={handleViewChange}
          onAddGroup={() => setShowAddGroup(true)}
          onAddSource={() => setShowAddSource(true)}
          onDeleteGroup={handleDeleteGroup}
          onDeleteSource={handleDeleteSource}
          onEditSource={(id) => {
            const source = rss.config?.sources.find((s: any) => s.id === id)
            if (source) setEditingSource(source)
          }}
        />

        {/* biome-ignore lint/a11y/useSemanticElements: separator pattern consistent with TileSplitter */}
        <div
          onMouseDown={startSidebarResize}
          role="separator"
          tabIndex={-1}
          aria-orientation="horizontal"
          aria-valuenow={50}
          className="splitter horizontal"
        />

        <ArticleList
          items={currentItems}
          bookmarks={rss.bookmarks}
          selectedItemId={rss.selectedItemId}
          sourceTitle={view === 'bookmarks' ? 'Bookmarks' : sourceTitle}
          loading={rss.loading}
          width={articleListWidth}
          groupByDate={isSingleFeed}
          showSourceBadge={showSourceBadge}
          onSelectItem={handleSelectItem}
          onMarkAllRead={handleMarkAllRead}
          onOpenExternal={handleOpenExternal}
        />

        {/* biome-ignore lint/a11y/useSemanticElements: separator pattern consistent with TileSplitter */}
        <div
          onMouseDown={startArticleListResize}
          role="separator"
          tabIndex={-1}
          aria-orientation="horizontal"
          aria-valuenow={50}
          className="splitter horizontal"
        />

        <ArticleDetail
          item={selectedItem}
          isBookmarked={isItemBookmarked}
          onToggleBookmark={handleToggleBookmark}
          onOpenExternal={handleOpenExternal}
        />
      </div>

      {/* Modals */}
      {showAddGroup && (
        <AddGroupModal
          isOpen={showAddGroup}
          onClose={() => setShowAddGroup(false)}
          onSubmit={handleAddGroup}
        />
      )}
      {showAddSource && (
        <AddSourceModal
          isOpen={showAddSource}
          onClose={() => setShowAddSource(false)}
          onSubmit={handleAddSource}
          groups={rss.config?.groups || []}
        />
      )}
      {editingSource && (
        <EditSourceModal
          isOpen={!!editingSource}
          onClose={() => setEditingSource(null)}
          onSubmit={handleEditSource}
          source={editingSource}
          groups={rss.config?.groups || []}
        />
      )}
    </div>
  )
}
