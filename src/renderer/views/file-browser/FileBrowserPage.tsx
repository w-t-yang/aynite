import { useCallback, useEffect, useRef, useState } from 'react'
import type { MatchingView } from '../../../lib/types/file-browser'
import type { FileInfo } from '../../../lib/types/files'
import { useAppEvent } from '../ViewContext'
import { FileContent } from './components/FileContent'
import { StatusBar } from './components/StatusBar'
import { TabBar } from './components/TabBar'

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
        const isText = await window.aynite.checkIsTextFile(activePath)
        const info = await window.aynite.getFileInfo(activePath)
        setFileInfo({
          ...info,
          createdAt: new Date(info.createdAt),
          modifiedAt: new Date(info.modifiedAt),
        })

        // Read all text files (including HTML/Markdown) as text
        if (isText) {
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
          const isText = await window.aynite.checkIsTextFile(activePath)
          if (isText) {
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

  // ─── HTML Mode (rendered preview vs source view) ──────────────────────
  const [htmlMode, setHtmlMode] = useState(false)

  // Default HTML files to rendered preview; reset on file switch
  useEffect(() => {
    const ext = fileInfo?.extension?.toLowerCase()
    if (ext === 'html' || ext === 'htm') {
      setHtmlMode(true)
    } else {
      setHtmlMode(false)
    }
  }, [fileInfo])

  const handleHtmlModeChange = useCallback((val: boolean) => {
    setHtmlMode(val)
    if (val) {
      setIsEditing(false)
    }
  }, [])

  // ─── View Preview State ─────────────────────────────────────────────────
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
    if (viewName !== null) {
      setIsEditing(false) // preview mode overrides edit
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

  // Reset editing mode when switching files
  useEffect(() => {
    setIsEditing(false)
  }, [])

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
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <FileContent
          path={activePath}
          content={content}
          fileInfo={fileInfo}
          loading={loading}
          error={error}
          isEditing={isEditing}
          htmlMode={htmlMode}
          onContentChange={setContent}
          activeView={activeView}
        />
      </div>
      {activePath && (
        <StatusBar
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          htmlMode={htmlMode}
          onHtmlModeChange={handleHtmlModeChange}
          fileInfo={fileInfo}
          content={content}
          onSave={handleSave}
          isDirty={isDirty}
          matchingViews={matchingViews}
          activeView={activeView}
          onSelectView={handleSelectView}
        />
      )}
    </div>
  )
}
