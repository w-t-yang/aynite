import { useEffect } from 'react'
import { FileContent } from './components/FileContent'
import { FileSearchBar } from './components/FileSearchBar'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'
import { useFileContent } from './hooks/useFileContent'
import { useFileModes } from './hooks/useFileModes'
import { useFileTabs } from './hooks/useFileTabs'
import { useSearchBar } from './hooks/useSearchBar'

export function FileBrowserPage() {
  // ── Hooks ──────────────────────────────────────────────────────────────
  const {
    tabs,
    activePath,
    dirtyPaths,
    setDirtyPaths,
    handleTabSelect,
    closeTab,
    closeAll,
  } = useFileTabs()

  const {
    content,
    setContent,
    originalContent,
    fileInfo,
    loading,
    error,
    isText,
    isDirty,
    handleSave,
  } = useFileContent(activePath)

  const {
    matchedFileviews,
    activeFileview,
    handleSelectFileview,
    isViewOnly,
    setIsViewOnly,
    isEditing,
    handleSetEditing,
    hasDiff,
    showDiff,
    handleShowDiff,
    diffHeadContent,
    diffCurrentContent,
    matchingViews,
    activeView,
    handleSelectView,
  } = useFileModes(activePath, fileInfo)

  const {
    showSearch,
    searchQuery,
    setSearchQuery,
    activeMatchIndex,
    totalMatchCount,
    handleSearchResult,
    nextMatch,
    prevMatch,
    openSearch,
    closeSearch,
    searchInputRef,
  } = useSearchBar()

  // Track dirty state per path
  useEffect(() => {
    if (!activePath) return
    setDirtyPaths((prev) => {
      const currentlyDirty = content !== originalContent
      if (
        (currentlyDirty && prev.has(activePath)) ||
        (!currentlyDirty && !prev.has(activePath))
      ) {
        return prev
      }
      const next = new Set(prev)
      if (currentlyDirty) {
        next.add(activePath)
      } else {
        next.delete(activePath)
      }
      return next
    })
  }, [content, originalContent, activePath, setDirtyPaths])

  // ── Keyboard Shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey

      if (isMod && e.key === 's') {
        e.preventDefault()
        if (isEditing) handleSave()
        return
      }

      if (isMod && e.key === 'f') {
        e.preventDefault()
        openSearch()
        return
      }

      if (showSearch) {
        if (isMod && e.key === 'n') {
          e.preventDefault()
          nextMatch()
          return
        }
        if (isMod && e.key === 'p') {
          e.preventDefault()
          prevMatch()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, handleSave, showSearch, openSearch, nextMatch, prevMatch])

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {activePath && (
        <TabBar
          tabs={tabs}
          activePath={activePath}
          dirtyPaths={dirtyPaths}
          onTabSelect={handleTabSelect}
          onTabClose={closeTab}
          onCloseAll={closeAll}
        />
      )}

      {showSearch && activePath && (
        <FileSearchBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          activeMatchIndex={activeMatchIndex}
          totalMatchCount={totalMatchCount}
          onNextMatch={nextMatch}
          onPrevMatch={prevMatch}
          onClose={closeSearch}
          searchInputRef={searchInputRef}
        />
      )}

      <div className="flex-1 overflow-hidden flex flex-col relative">
        <FileContent
          path={activePath}
          content={content}
          fileInfo={fileInfo}
          loading={loading}
          error={error}
          isEditing={isEditing}
          isViewOnly={isViewOnly}
          onContentChange={setContent}
          activeView={activeView}
          activeFileview={activeFileview}
          showDiff={showDiff}
          diffHeadContent={diffHeadContent}
          diffCurrentContent={diffCurrentContent}
          isText={isText}
          searchQuery={showSearch ? searchQuery : undefined}
          activeMatchIndex={activeMatchIndex}
          onSearchResult={handleSearchResult}
        />
      </div>

      {activePath && (
        <StatusBar
          isEditing={isEditing}
          setIsEditing={handleSetEditing}
          isViewOnly={isViewOnly}
          setIsViewOnly={setIsViewOnly}
          showDiff={showDiff}
          hasDiff={hasDiff}
          onShowDiff={handleShowDiff}
          fileInfo={fileInfo}
          content={content}
          onSave={handleSave}
          isDirty={isDirty}
          isText={isText}
          matchingViews={matchingViews}
          activeView={activeView}
          onSelectView={handleSelectView}
          matchedFileviews={matchedFileviews}
          activeFileview={activeFileview}
          onSelectFileview={handleSelectFileview}
        />
      )}
    </div>
  )
}
