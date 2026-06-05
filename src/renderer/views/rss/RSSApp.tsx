import { Keyboard, Loader2, RefreshCw, Rss } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { systemMutations } from '../../bridge/system'
import { Tooltip } from '../../shared/basic/Tooltip'
import { useViewEvent } from '../useViewEvents'
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

  // Keyboard navigation state
  const [focusColumn, setFocusColumn] = useState(0) // 0=sidebar, 1=articleList, 2=articleDetail
  const [focusRow, setFocusRow] = useState(0)

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
  useViewEvent(
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
    systemMutations.openExternal(url)
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

  // Compute navigation bounds (must be before handleKeyDown which closes over them)
  const sidebarItemCount = useMemo(() => {
    if (!rss.config) return 0
    let count = 0
    if (rss.config.sources.length > 0) count += 1 // "Today" row
    count += rss.config.sources.length
    return count
  }, [rss.config])

  // Build flat list of sidebar source IDs for focus→selection mapping
  const sidebarSourceIds = useMemo(() => {
    if (!rss.config) return []
    const ids: string[] = []
    for (const group of rss.config.groups) {
      for (const source of rss.config.sources) {
        if (source.groupId === group.id) {
          ids.push(source.id)
        }
      }
    }
    // Orphaned sources
    for (const source of rss.config.sources) {
      if (!rss.config.groups.find((g) => g.id === source.groupId)) {
        ids.push(source.id)
      }
    }
    return ids
  }, [rss.config])

  // Determine which items to show based on view mode and selection
  const currentItems =
    view === 'bookmarks' ? rss.getBookmarkedItems() : rss.getCurrentItems()

  // ─── Sync focus → actual selection ────────────────────────────────────
  // When focus changes in column 0 (sidebar), select that source.
  // When focus changes in column 1 (article list), select that item.
  useEffect(() => {
    if (focusColumn === 0) {
      const todayShown = rss.config ? rss.config.sources.length > 0 : false
      if (todayShown && focusRow === 0) {
        // Row 0 = Today
        rss.selectSource('__today__')
        rss.selectItem(null)
      } else {
        const sourceIdx = focusRow - (todayShown ? 1 : 0)
        const sourceId = sidebarSourceIds[sourceIdx]
        if (sourceId !== undefined && sourceId !== rss.selectedSourceId) {
          rss.selectSource(sourceId)
          rss.selectItem(null)
        }
      }
    }
  }, [focusColumn, focusRow, sidebarSourceIds, rss])

  useEffect(() => {
    if (focusColumn === 1 && currentItems.length > 0) {
      const item = currentItems[focusRow]
      if (item && item.id !== rss.selectedItemId) {
        rss.selectItem(item.id)
        rss.markRead(item.id)
      }
    }
  }, [focusColumn, focusRow, currentItems, rss])

  // Auto-focus the view root so keyboard events are captured immediately
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Small delay to ensure the iframe has rendered and focus can be set
    const timer = setTimeout(() => {
      rootRef.current?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // ─── Keyboard Navigation ──────────────────────────────────────────────

  // Resolve key binding from config: e.g. { key: 'a' } or { key: ' ', ctrl: true }
  const bindingMatches = useCallback(
    (
      binding: { key: string; ctrl?: boolean; shift?: boolean },
      e: KeyboardEvent,
    ) => {
      if (binding.key !== e.key && binding.key !== e.code) return false
      if (binding.ctrl && !e.ctrlKey && !e.metaKey) return false
      if (binding.shift && !e.shiftKey) return false
      return true
    },
    [],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showAddGroup || showAddSource || editingSource) return

      const kb = rss.keyBindings

      // Move left
      if (kb.move_left && bindingMatches(kb.move_left, e)) {
        e.preventDefault()
        if (focusColumn > 0) {
          setFocusColumn((c) => c - 1)
          setFocusRow(0)
        }
        return
      }

      // Move right
      if (kb.move_right && bindingMatches(kb.move_right, e)) {
        e.preventDefault()
        if (focusColumn < 2) {
          setFocusColumn((c) => c + 1)
          setFocusRow(0)
        }
        return
      }

      // Move up
      if (kb.move_up && bindingMatches(kb.move_up, e)) {
        e.preventDefault()
        const maxRow =
          focusColumn === 0 ? sidebarItemCount - 1 : currentItems.length - 1
        if (maxRow >= 0) {
          setFocusRow((r) => (r > 0 ? r - 1 : maxRow))
        }
        return
      }

      // Move down
      if (kb.move_down && bindingMatches(kb.move_down, e)) {
        e.preventDefault()
        const maxRow =
          focusColumn === 0 ? sidebarItemCount - 1 : currentItems.length - 1
        if (maxRow >= 0) {
          setFocusRow((r) => (r < maxRow ? r + 1 : 0))
        }
        return
      }

      // Open in browser (space)
      if (kb.open_in_browser && bindingMatches(kb.open_in_browser, e)) {
        e.preventDefault()
        if (focusColumn === 1) {
          // Article list — open the focused item
          const item = currentItems[focusRow]
          if (item) {
            systemMutations.openExternal(item.link)
          }
        } else if (focusColumn === 2) {
          // Article detail — open the selected item
          const item = rss.getSelectedItem()
          if (item) {
            systemMutations.openExternal(item.link)
          }
        }
        return
      }
    },
    [
      focusColumn,
      focusRow,
      sidebarItemCount,
      currentItems,
      rss.keyBindings,
      rss,
      bindingMatches,
      showAddGroup,
      showAddSource,
      editingSource,
    ],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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

  // Build the keybindings tooltip text
  const keybindingsTooltip = useMemo(() => {
    const fmt = (kb: { key: string; ctrl?: boolean; shift?: boolean }) => {
      const parts: string[] = []
      if (kb.ctrl) parts.push('Ctrl')
      if (kb.shift) parts.push('Shift')
      const keyLabel = kb.key === ' ' ? 'Space' : kb.key.toUpperCase()
      parts.push(keyLabel)
      return parts.join('+')
    }
    const lines: string[] = ['Keyboard shortcuts']
    if (rss.keyBindings.move_left)
      lines.push(`${fmt(rss.keyBindings.move_left)} — Move left`)
    if (rss.keyBindings.move_right)
      lines.push(`${fmt(rss.keyBindings.move_right)} — Move right`)
    if (rss.keyBindings.move_up)
      lines.push(`${fmt(rss.keyBindings.move_up)} — Move up`)
    if (rss.keyBindings.move_down)
      lines.push(`${fmt(rss.keyBindings.move_down)} — Move down`)
    if (rss.keyBindings.open_in_browser)
      lines.push(`${fmt(rss.keyBindings.open_in_browser)} — Open in browser`)
    return lines.join('\n')
  }, [rss.keyBindings])

  if (rss.loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="flex flex-col h-full bg-background text-foreground outline-none"
    >
      {/* Header */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 bg-muted/30 justify-between shrink-0 relative z-popover">
        <div className="flex items-center gap-2 min-w-0">
          <Tooltip position="bottom" content="RSS Reader">
            <Rss size={14} className="text-primary" />
          </Tooltip>
          <span className="text-[10px] font-bold uppercase tracking-widest truncate text-muted-foreground">
            RSS Reader
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip position="bottom" align="right" content={keybindingsTooltip}>
            <Keyboard
              size={13}
              className="text-muted-foreground/50 cursor-help"
            />
          </Tooltip>
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
          focusColumn={focusColumn}
          focusRow={focusRow}
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
          focusColumn={focusColumn}
          focusRow={focusRow}
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
          focusColumn={focusColumn}
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
