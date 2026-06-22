import { useCallback, useEffect, useMemo, useState } from 'react'
import { workspace } from '../../bridge/workspace'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { useAppEvent, useView } from '../ViewContext'
import { FileContent } from './components/FileContent'
import { FileSearchBar } from './components/FileSearchBar'
import { FinderBar } from './components/FinderBar'
import { FolderContentViewer } from './components/FolderContentViewer'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'
import viewConfig from './config.json'
import { useFileContent } from './hooks/useFileContent'
import { useFileModes } from './hooks/useFileModes'
import { useFileTabs } from './hooks/useFileTabs'
import { useSearchBar } from './hooks/useSearchBar'

interface BreadcrumbSegment {
  label: string
  path: string
}

/**
 * Compute breadcrumb segments from an absolute file path.
 * Strips the workspace folder prefix and creates clickable segments
 * for each path component up to (and including) the file.
 */
function buildBreadcrumbSegments(
  filePath: string | null,
  workspaceFolders: string[],
): BreadcrumbSegment[] {
  if (!filePath) return []

  const normalized = filePath.replace(/\\/g, '/')

  // Find the longest matching workspace folder as root
  let root = ''
  for (const folder of workspaceFolders) {
    const normalizedFolder = folder.replace(/\\/g, '/')
    if (
      normalized.startsWith(normalizedFolder) &&
      normalizedFolder.length > root.length
    ) {
      root = normalizedFolder
    }
  }

  // If no workspace folder matches, use the absolute path as-is
  const segments: BreadcrumbSegment[] = []

  if (root) {
    // Include the project folder itself as the first segment
    const folderName = root.split('/').filter(Boolean).pop() || root
    segments.push({ label: folderName, path: root })
  }

  const relPath = root
    ? normalized.slice(root.length).replace(/^\//, '')
    : normalized

  const parts = relPath.split('/').filter(Boolean)

  for (const part of parts) {
    const relJoined = parts.slice(0, parts.indexOf(part) + 1).join('/')
    const segPath = root ? `${root}/${relJoined}` : relJoined
    segments.push({ label: part, path: segPath })
  }

  return segments
}

export function FileBrowserPage() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

  // ── Mode (tab vs finder) ──────────────────────────────────────────────
  const [mode, setMode] = useState<'tab' | 'finder'>('tab')

  // ── Folder browsing & view mode ──────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [browsingFolder, setBrowsingFolder] = useState<string | null>(null)
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>([])

  // Load workspace folders on mount
  useEffect(() => {
    workspace
      .folders()
      .then(setWorkspaceFolders)
      .catch(() => {})
  }, [])

  // Listen for folder-open requests from other views (e.g. workspace view)
  useAppEvent(
    'open-folder-in-finder',
    (data: { path?: string }) => {
      if (data?.path) {
        setMode('finder')
        setBrowsingFolder(data.path)
      }
    },
    [],
  )

  // ── Hooks ──────────────────────────────────────────────────────────────
  const {
    tabs,
    activePath,
    dirtyPaths,
    setDirtyPaths,
    handleTabSelect,
    closeTab,
    closeAll,
    openFile,
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

  // When a file is opened from outside (e.g. git diff view) while browsing
  // a folder, clear browsingFolder so the file content is shown instead.
  useEffect(() => {
    if (activePath && browsingFolder) {
      setBrowsingFolder(null)
    }
  }, [activePath, browsingFolder])

  // ── Breadcrumb ───────────────────────────────────────────────────────
  const breadcrumbSegments = useMemo(
    () =>
      buildBreadcrumbSegments(browsingFolder || activePath, workspaceFolders),
    [browsingFolder, activePath, workspaceFolders],
  )

  // ── Folder navigation callbacks ──────────────────────────────────────
  const handleFolderBrowse = useCallback((folder: string) => {
    setBrowsingFolder(folder)
  }, [])

  const handleFileFromFolder = useCallback(
    (filePath: string) => {
      openFile(filePath)
      setBrowsingFolder(null)
    },
    [openFile],
  )

  const handleSubfolderClick = useCallback((folder: string) => {
    setBrowsingFolder(folder)
  }, [])

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
      {activePath && mode === 'tab' && (
        <TabBar
          tabs={tabs}
          activePath={activePath}
          dirtyPaths={dirtyPaths}
          onTabSelect={handleTabSelect}
          onTabClose={closeTab}
          onCloseAll={closeAll}
          onSwitchToFinderMode={() => {
            setBrowsingFolder(null)
            setMode('finder')
          }}
          t={t}
        />
      )}
      {mode === 'finder' && (
        <FinderBar
          tabs={tabs}
          activePath={activePath}
          breadcrumbSegments={breadcrumbSegments}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onTabSelect={handleTabSelect}
          onFolderBrowse={handleFolderBrowse}
          onTabClose={closeTab}
          onCloseAll={closeAll}
          onSwitchToTabMode={() => {
            setBrowsingFolder(null)
            setMode('tab')
          }}
          t={t}
        />
      )}

      {showSearch && activePath && !browsingFolder && (
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
        {browsingFolder ? (
          <FolderContentViewer
            folderPath={browsingFolder}
            viewMode={viewMode}
            onFileClick={handleFileFromFolder}
            onFolderClick={handleSubfolderClick}
          />
        ) : activePath ? (
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
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/30 italic">
              Open a file to get started
            </p>
          </div>
        )}
      </div>

      {activePath && !browsingFolder && (
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
