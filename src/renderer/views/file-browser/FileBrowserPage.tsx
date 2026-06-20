import { useEffect, useMemo } from 'react'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { useView } from '../ViewContext'
import { FileContent } from './components/FileContent'
import { FileSearchBar } from './components/FileSearchBar'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'
import viewConfig from './config.json'
import { useFileContent } from './hooks/useFileContent'
import { useFileModes } from './hooks/useFileModes'
import { useFileTabs } from './hooks/useFileTabs'
import { useSearchBar } from './hooks/useSearchBar'

export function FileBrowserPage() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)
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

  // Show error message for files that no longer exist on disk
  // (tabs stay open so the user sees the error and can close manually)

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
          t={t}
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
          t={t}
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
          t={t}
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
          t={t}
        />
      )}
    </div>
  )
}
