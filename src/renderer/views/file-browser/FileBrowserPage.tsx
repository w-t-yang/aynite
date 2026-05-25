import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MatchingView } from '../../../lib/types/file-browser'
import type { FileInfo } from '../../../lib/types/files'
import { useAppEvent } from '../ViewContext'
import { FileContent } from './components/FileContent'
import type { FileviewConfig } from './components/StatusBar'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'
import { fileviewComponents } from './fileview-registry'

// Known fileview directory names (used to load their configs for extension matching)
const FILEVIEW_NAMES = Object.keys(fileviewComponents)

interface Tab {
  name: string
  path: string
}

export function FileBrowserPage() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  // History of active paths for "last active" closing logic
  const [history, setHistory] = useState<string[]>([])

  // Content state
  const [content, setContent] = useState<string | null>(null)
  const [originalContent, setOriginalContent] = useState<string | null>(null)
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isText, setIsText] = useState(false)

  // Track dirty state per path
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set())

  const isDirty = content !== originalContent && activePath !== null

  // Update dirty paths set
  useEffect(() => {
    if (!activePath) return
    setDirtyPaths((prev) => {
      if (
        (content !== originalContent && prev.has(activePath)) ||
        (content === originalContent && !prev.has(activePath))
      ) {
        return prev
      }
      const next = new Set(prev)
      if (content !== originalContent) {
        next.add(activePath)
      } else {
        next.delete(activePath)
      }
      return next
    })
  }, [content, originalContent, activePath])

  // Track if we are currently handling a broadcast to avoid infinite loops
  const isBroadcastingRef = useRef(false)
  const isInitializedRef = useRef(false)

  const openFile = useCallback((path: string) => {
    const name = path.split(/[/\\]/).pop() || path
    setTabs((prev) => {
      if (prev.some((t) => t.path === path)) return prev
      return [...prev, { name, path }]
    })

    // Update history: remove if exists, then add to end (most recent)
    setHistory((prev) => {
      const filtered = prev.filter((p) => p !== path)
      return [...filtered, path]
    })

    setActivePath(path)
  }, [])

  const handleTabSelect = useCallback(
    (path: string) => {
      if (activePath === path) return

      // Notify main about active file change
      isBroadcastingRef.current = true
      window.aynite.setConfig('activeFile', path).finally(() => {
        isBroadcastingRef.current = false
      })

      setActivePath(path)
      setHistory((prev) => {
        const filtered = prev.filter((p) => p !== path)
        return [...filtered, path]
      })
    },
    [activePath],
  )

  const closeTab = useCallback(
    (path: string) => {
      setTabs((prev) => {
        const newTabs = prev.filter((t) => t.path !== path)
        const newHistory = history.filter((p) => p !== path)
        setHistory(newHistory)

        if (activePath === path) {
          if (newHistory.length > 0) {
            const nextActive = newHistory[newHistory.length - 1]
            handleTabSelect(nextActive)
          } else {
            setActivePath(null)
            window.aynite.setConfig('activeFile', null)
          }
        }
        return newTabs
      })
    },
    [activePath, history, handleTabSelect],
  )

  const closeAll = useCallback(() => {
    setTabs([])
    setActivePath(null)
    setHistory([])
    window.aynite.setConfig('activeFile', null)
  }, [])

  // Initial load of active file and opened files
  useEffect(() => {
    const init = async () => {
      const paths = await window.aynite.getConfig('openedFiles')
      if (paths && Array.isArray(paths) && paths.length > 0) {
        const initialTabs = paths.map((p: string) => ({
          name: p.split(/[/\\]/).pop() || p,
          path: p,
        }))
        setTabs(initialTabs)
        setHistory(paths)
      }

      const active = await window.aynite.getConfig('activeFile')
      if (active) {
        setActivePath(active)
        // Ensure it's in the tabs
        setTabs((prev) => {
          if (prev.some((t) => t.path === active)) return prev
          return [
            ...prev,
            { name: active.split(/[/\\]/).pop() || active, path: active },
          ]
        })
      }
      isInitializedRef.current = true
    }
    init()
  }, [])

  // Persist tabs to main
  useEffect(() => {
    if (!isInitializedRef.current) return
    window.aynite.setConfig(
      'openedFiles',
      tabs.map((t) => t.path),
    )
  }, [tabs])

  // Listen for active-file-changed broadcast from main
  useAppEvent('active-file-changed', (data: { path: string }) => {
    if (isBroadcastingRef.current) return
    if (data?.path) {
      openFile(data.path)
    } else {
      setActivePath(null)
    }
  })

  // Load file content when activePath changes
  useEffect(() => {
    if (!activePath) {
      setContent(null)
      setFileInfo(null)
      return
    }

    // Clear state immediately to show loading for the new file
    setContent(null)
    setOriginalContent(null)
    setFileInfo(null)

    const loadFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const textStatus = await window.aynite.checkIsTextFile(activePath)
        setIsText(textStatus)
        const info = await window.aynite.getFileInfo(activePath)
        setFileInfo({
          ...info,
          createdAt: new Date(info.createdAt),
          modifiedAt: new Date(info.modifiedAt),
        })

        // Read all text files as text
        if (textStatus) {
          const text = await window.aynite.readFile(activePath)
          setContent(text)
          setOriginalContent(text)
        } else {
          setContent(null)
          setOriginalContent(null)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [activePath])

  // Watch only the currently open file for external changes
  // Uses 1 FD instead of thousands from recursive directory watching
  useEffect(() => {
    window.aynite.watchFile(activePath)
  }, [activePath])

  // Reload active file if it changes on disk
  useAppEvent('fs-change', (data: { event: string; path: string }) => {
    if (!activePath || isBroadcastingRef.current) return
    const normalizedChanged = data.path.replace(/\\/g, '/')
    const normalizedActive = activePath.replace(/\\/g, '/')

    if (normalizedChanged === normalizedActive && data.event === 'change') {
      // Re-trigger the load effect by just calling loadFile logic or slightly updating state
      // For simplicity, we just trigger a refresh
      const refresh = async () => {
        try {
          const textStatus = await window.aynite.checkIsTextFile(activePath)
          setIsText(textStatus)
          if (textStatus) {
            const text = await window.aynite.readFile(activePath)
            setContent(text)
          }
          const info = await window.aynite.getFileInfo(activePath)
          setFileInfo({
            ...info,
            createdAt: new Date(info.createdAt),
            modifiedAt: new Date(info.modifiedAt),
          })
        } catch (e) {
          console.error('Failed to refresh file on disk change', e)
        }
      }
      refresh()
    }
  })

  const [isEditing, setIsEditing] = useState(false)

  // ─── Search Bar State ───────────────────────────────────────────────────
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMatchIndex, setActiveMatchIndex] = useState(0)
  const [totalMatchCount, setTotalMatchCount] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input when shown
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  // Reset active match index when query changes
  useEffect(() => {
    setActiveMatchIndex(0)
  }, [])

  const handleSearchResult = useCallback((total: number) => {
    setTotalMatchCount(total)
  }, [])

  // ─── Fileview Mode (matched viewers like Markdown, HTML, Image, etc.) ──
  const [matchedFileviews, setMatchedFileviews] = useState<
    Array<{ view: string; config: FileviewConfig }>
  >([])
  const [activeFileview, setActiveFileview] = useState<string | null>(null)
  const [isViewOnly, setIsViewOnly] = useState(true)

  // Load fileview configs and match against current file extension
  useEffect(() => {
    setMatchedFileviews([])
    setActiveFileview(null)
    setIsViewOnly(true)
    setIsEditing(false)

    if (!activePath || !fileInfo) return

    const ext = fileInfo.extension?.toLowerCase()
    if (!ext) return

    let cancelled = false
    ;(async () => {
      const matches: Array<{ view: string; config: FileviewConfig }> = []
      for (const viewName of FILEVIEW_NAMES) {
        const config = (await window.aynite.getConfig('view-config', {
          view: viewName,
        })) as FileviewConfig | null
        if (!config?.file_extensions) continue
        if (config.file_extensions.includes(ext)) {
          matches.push({ view: viewName, config })
        }
      }
      if (cancelled) return
      setMatchedFileviews(matches)

      // Auto-select first matching fileview as the active mode
      if (matches.length > 0) {
        setActiveFileview(matches[0].view)
        setIsViewOnly(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activePath, fileInfo])

  const handleSelectFileview = useCallback((view: string | null) => {
    setActiveFileview(view)
    if (view !== null) {
      setIsEditing(false)
      setIsViewOnly(false)
    }
  }, [])

  // ─── View Preview State (dataview matching for JSON files) ──────────────
  const [matchingViews, setMatchingViews] = useState<MatchingView[]>([])
  const [activeView, setActiveView] = useState<string | null>(null)

  // Load matching views when activePath changes (JSON/text files only)
  useEffect(() => {
    setMatchingViews([])
    setActiveView(null)

    if (!activePath || !fileInfo) return
    // Only try matching for JSON files (the main expected_file_type)
    if (fileInfo.extension?.toLowerCase() !== 'json') return

    let cancelled = false
    ;(async () => {
      try {
        const views = await (window as any).aynite.getConfig('matching-views', {
          filePath: activePath,
        })
        if (!cancelled && Array.isArray(views) && views.length > 0) {
          setMatchingViews(views)
          // Auto-select first matching view as the active preview
          setActiveView(views[0].name)
        } else if (!cancelled) {
          setActiveView(null)
        }
      } catch {
        // Silently fail — matching is best-effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activePath, fileInfo])

  const handleSelectView = useCallback((viewName: string | null) => {
    setActiveView(viewName)
    setActiveFileview(null)
    if (viewName !== null) {
      setIsEditing(false) // preview mode overrides edit
      setIsViewOnly(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!activePath || content === null) return
    try {
      await window.aynite.writeFile(activePath, content)
      setOriginalContent(content)
      // Notify main and other views if needed
    } catch (e) {
      console.error('Failed to save file:', e)
    }
  }, [activePath, content])

  // Reset editing mode when switching files (empty deps = runs once on mount)
  useEffect(() => {
    setIsEditing(false)
  }, [])

  // ─── Keyboard Shortcuts ───────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey

      // Save: Ctrl+S / Cmd+S
      if (isMod && e.key === 's') {
        e.preventDefault()
        if (isEditing) {
          handleSave()
        }
        return
      }

      // Search: Ctrl+F / Cmd+F (only in edit mode)
      if (isMod && e.key === 'f' && isEditing) {
        e.preventDefault()
        setShowSearch((prev) => !prev)
        setSearchQuery('')
        setActiveMatchIndex(0)
        return
      }

      // Search navigation (only when search bar is open)
      if (showSearch) {
        // Next match: Ctrl+N
        if (isMod && e.key === 'n') {
          e.preventDefault()
          setActiveMatchIndex((prev) =>
            totalMatchCount > 0 ? (prev + 1) % totalMatchCount : 0,
          )
          return
        }
        // Previous match: Ctrl+P
        if (isMod && e.key === 'p') {
          e.preventDefault()
          setActiveMatchIndex((prev) =>
            totalMatchCount > 0
              ? (prev - 1 + totalMatchCount) % totalMatchCount
              : 0,
          )
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, handleSave, showSearch, totalMatchCount])

  // Close search on Escape (separate handler)
  useEffect(() => {
    if (!showSearch) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearch(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showSearch])

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

      {/* ─── Search Bar ──────────────────────────────────────────────── */}
      {showSearch && activePath && (
        <div className="shrink-0 bg-sidebar border-b border-border flex items-center gap-2 px-3 py-1.5 select-none">
          <Search size={13} className="text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find in file…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSearch(false)
                setSearchQuery('')
              }
            }}
          />
          {searchQuery && (
            <span className="text-[11px] text-muted-foreground/50 shrink-0">
              {totalMatchCount > 0
                ? `${activeMatchIndex + 1} of ${totalMatchCount} matches`
                : 'No matches'}
            </span>
          )}

          {totalMatchCount > 0 && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setActiveMatchIndex(
                    (prev) => (prev - 1 + totalMatchCount) % totalMatchCount,
                  )
                }
                title="Previous match (Ctrl+P)"
                className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveMatchIndex((prev) => (prev + 1) % totalMatchCount)
                }
                title="Next match (Ctrl+N)"
                className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowSearch(false)
              setSearchQuery('')
            }}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors ml-0.5"
          >
            <X size={13} />
          </button>
        </div>
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
          isText={isText}
          searchQuery={showSearch ? searchQuery : undefined}
          activeMatchIndex={activeMatchIndex}
          onSearchResult={handleSearchResult}
        />
      </div>
      {activePath && (
        <StatusBar
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          isViewOnly={isViewOnly}
          setIsViewOnly={setIsViewOnly}
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
