/**
 * Hook for file mode selection: fileview, diff, edit, and view preview.
 *
 * Manages the complex mode-selection logic including:
 * - Fileview matching (which viewer to use for a file extension)
 * - Git diff detection and display
 * - Dataview matching for JSON files
 * - The userModeRef pattern to prevent async mode auto-detection
 *   from overriding user-selected modes
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { fileviewComponents } from '../../../../lib/constants/fileview-components'
import type {
  FileviewConfig,
  MatchingView,
} from '../../../../lib/types/file-browser'
import type { FileInfo } from '../../../../lib/types/files'
import { config } from '../../../bridge/config'
import { file as bridgeFile } from '../../../bridge/file'
import { git } from '../../../bridge/git'
import { useViewEvent } from '../../useViewEvents'

const FILEVIEW_NAMES = Object.keys(fileviewComponents)

export function useFileModes(
  activePath: string | null,
  fileInfo: FileInfo | null,
) {
  // Fileview matching
  const [matchedFileviews, setMatchedFileviews] = useState<
    Array<{ view: string; config: FileviewConfig }>
  >([])
  const [activeFileview, setActiveFileview] = useState<string | null>(null)
  const [isViewOnly, setIsViewOnly] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // Diff mode
  const [hasDiff, setHasDiff] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [diffHeadContent, setDiffHeadContent] = useState<string | null>(null)
  const [diffCurrentContent, setDiffCurrentContent] = useState<string | null>(
    null,
  )

  // View preview (dataview matching for JSON)
  const [matchingViews, setMatchingViews] = useState<MatchingView[]>([])
  const [activeView, setActiveView] = useState<string | null>(null)

  // userModeRef prevents async mode auto-detection from overriding user's choice
  const userModeRef = useRef(false)
  const activePathRef = useRef(activePath)
  activePathRef.current = activePath

  // ── Git status change listener (re-evaluate diff after commit) ────
  const [_diffRefreshKey, setDiffRefreshKey] = useState(0)

  // ── Mode Selection Effect ──────────────────────────────────────────
  useEffect(() => {
    const prevActivePath = activePathRef.current

    if (activePath !== prevActivePath) {
      userModeRef.current = false
    }

    if (!userModeRef.current) {
      setIsEditing(false)
      setActiveFileview(null)
      setActiveView(null)
      setMatchedFileviews([])
      setHasDiff(false)
      setShowDiff(false)
      setDiffHeadContent(null)
      setDiffCurrentContent(null)
    } else {
      setHasDiff(false)
      setDiffHeadContent(null)
      setDiffCurrentContent(null)
    }

    if (!activePath) {
      if (!userModeRef.current) setIsViewOnly(true)
      return
    }

    const ext = activePath.split('.').pop()?.toLowerCase()
    if (!ext) {
      if (!userModeRef.current) setIsViewOnly(true)
      return
    }

    let cancelled = false
    ;(async () => {
      // 1. Load fileview configs
      const matches: Array<{ view: string; config: FileviewConfig }> = []
      for (const viewName of FILEVIEW_NAMES) {
        try {
          const viewCfg = (await config.getWithPayload('view-config', {
            view: viewName,
          })) as FileviewConfig | null
          if (!viewCfg?.file_extensions) continue
          if (viewCfg.file_extensions.includes(ext)) {
            matches.push({ view: viewName, config: viewCfg })
          }
        } catch {
          // skip unavailable fileviews
        }
      }

      // 2. Check git diff status
      let diffResult: { head: string; current: string } | null = null
      try {
        const statusMap = await git.getStatus(activePath)
        if (!cancelled && statusMap?.[activePath]) {
          const [base, current] = await Promise.all([
            git.getIndexContent(activePath),
            bridgeFile.read(activePath),
          ])
          if (base) diffResult = { head: base, current: current || '' }
        }
      } catch {
        // not a git file
      }

      if (cancelled) return

      // 3. Always update fileview matches and diff metadata
      setMatchedFileviews(matches)
      if (diffResult) {
        setHasDiff(true)
        setDiffHeadContent(diffResult.head)
        setDiffCurrentContent(diffResult.current)
      }

      // 4. Auto-select mode ONLY if user hasn't manually chosen one
      if (!userModeRef.current) {
        if (matches.length > 0) {
          setActiveFileview(matches[0].view)
          setIsViewOnly(false)
        } else if (diffResult) {
          setShowDiff(true)
          setIsViewOnly(false)
        } else {
          setShowDiff(false)
          setIsViewOnly(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activePath])

  // ── Dataview matching (for JSON files) ─────────────────────────────
  useEffect(() => {
    setMatchingViews([])
    setActiveView(null)

    if (!activePath || !fileInfo) return
    if (fileInfo.extension?.toLowerCase() !== 'json') return

    let cancelled = false
    ;(async () => {
      try {
        const views = await config.getWithPayload('matching-views', {
          filePath: activePath,
        })
        if (!cancelled && Array.isArray(views) && views.length > 0) {
          setMatchingViews(views)
          setActiveView(views[0].name)
        } else if (!cancelled) {
          setActiveView(null)
        }
      } catch {
        // best-effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activePath, fileInfo])

  // ── Git status change listener (re-evaluate diff after commit) ────
  const handleGitStatusChanged = useCallback((data: { root: string }) => {
    if (data?.root && activePathRef.current?.startsWith(data.root)) {
      setDiffRefreshKey((prev) => prev + 1)
    }
  }, [])
  useViewEvent('git-status-changed', handleGitStatusChanged)

  // ── Mode selection callbacks (set userModeRef to prevent override) ─
  const handleSelectFileview = useCallback((view: string | null) => {
    userModeRef.current = true
    setActiveFileview(view)
    setActiveView(null)
    setShowDiff(false)
    if (view !== null) {
      setIsEditing(false)
      setIsViewOnly(false)
    } else {
      setIsViewOnly(true)
    }
  }, [])

  const handleShowDiff = useCallback(() => {
    userModeRef.current = true
    setShowDiff(true)
    setActiveFileview(null)
    setActiveView(null)
    setIsEditing(false)
    setIsViewOnly(false)
  }, [])

  const handleSelectView = useCallback((viewName: string | null) => {
    userModeRef.current = true
    setActiveView(viewName)
    setActiveFileview(null)
    setShowDiff(false)
    if (viewName !== null) {
      setIsEditing(false)
      setIsViewOnly(false)
    }
  }, [])

  const handleSetEditing = useCallback((val: boolean) => {
    if (val) userModeRef.current = true
    setIsEditing(val)
  }, [])

  return {
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
  }
}
