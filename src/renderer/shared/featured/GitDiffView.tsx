import { GitBranch, GitCommitHorizontal, RefreshCw } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { DiffStats } from '../../../lib/types/files'
import { git, gitMutations } from '../../bridge/git'
import { useViewEvent } from '../../views/useViewEvents'
import { Button } from '../basic/Button'
import { Modal } from '../basic/Modal'
import { cn, normalizePath } from '../lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GitChangedFile {
  name: string
  path: string
  status: string
}

interface CommitState {
  generating: boolean
  message: string
  root: string
  error: string | null
}

interface GitDiffViewProps {
  /** List of workspace folder paths to check for git status */
  folders: string[]
  /** Callback when a changed file is clicked */
  onSelectFile?: (path: string) => void
  /** Optional className for styling */
  className?: string
  /** If true, renders folder headers with names (default: true). Set to false when the parent already renders folder rows. */
  showFolderHeaders?: boolean
}

// ─── Status Helpers ─────────────────────────────────────────────────────────

const statusConfig: Record<string, { letter: string; className: string }> = {
  modified: { letter: 'M', className: 'text-amber-400' },
  added: { letter: 'A', className: 'text-green-400' },
  untracked: { letter: 'U', className: 'text-blue-400' },
  deleted: { letter: 'D', className: 'text-red-400' },
  renamed: { letter: 'R', className: 'text-purple-400' },
}

function getStatusConfig(status: string) {
  return (
    statusConfig[status] || { letter: '?', className: 'text-muted-foreground' }
  )
}

// ─── Memoized File Item ─────────────────────────────────────────────────────

interface FileItemProps {
  file: GitChangedFile
  stat: DiffStats | undefined
  statusConfig: { letter: string; className: string }
  onSelect: (path: string) => void
}

const FileItem = React.memo(function FileItem({
  file,
  stat,
  statusConfig,
  onSelect,
}: FileItemProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSelect(file.path)}
      className="w-full justify-start text-left hover:bg-accent/10"
      title={file.path}
    >
      <span
        className={`text-[10px] font-bold font-mono shrink-0 w-5 ${statusConfig.className}`}
      >
        {statusConfig.letter}
      </span>
      <span className="truncate flex-1">{file.name}</span>
      {stat && (
        <span className="text-[10px] font-mono leading-none whitespace-nowrap shrink-0">
          {stat.additions > 0 && (
            <span className="text-green-500">+{stat.additions}</span>
          )}
          {stat.additions > 0 && stat.deletions > 0 && (
            <span className="text-muted-foreground/40"> </span>
          )}
          {stat.deletions > 0 && (
            <span className="text-red-500">-{stat.deletions}</span>
          )}
        </span>
      )}
    </Button>
  )
})

// ─── Component ──────────────────────────────────────────────────────────────

export function GitDiffView({
  folders,
  onSelectFile,
  className,
  showFolderHeaders = true,
}: GitDiffViewProps) {
  const [gitRoots, setGitRoots] = useState<Set<string>>(new Set())
  const [gitChangedFiles, setGitChangedFiles] = useState<
    Record<string, GitChangedFile[]>
  >({})
  const [diffStats, setDiffStats] = useState<Record<string, DiffStats>>({})
  const [commitState, setCommitState] = useState<CommitState | null>(null)

  // ─── Stable folders key ───────────────────────────────────────────────────
  // `folders` is often created as `arr.map(...)` in the parent, which creates
  // a NEW array reference on every parent render. Using `folders` directly as
  // an effect dep causes an infinite loop: effect fires → loadGitStatus →
  // setState → re-render → effect fires again (because folders is a new ref).
  // We stabilize by comparing CONTENT, not reference.
  const prevFoldersRef = useRef<string[]>([])
  if (
    prevFoldersRef.current.length !== folders.length ||
    prevFoldersRef.current.some((f, i) => f !== folders[i])
  ) {
    prevFoldersRef.current = folders
  }
  // Stable key that only changes when folder paths actually change
  const _foldersKey = prevFoldersRef.current.join('\x00')

  // Guard against concurrent loadGitStatus calls
  const loadingRef = useRef(false)

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const loadGitStatus = useCallback(
    async (folderPaths: string[], forceRefresh = false) => {
      if (loadingRef.current) return // skip if already loading
      loadingRef.current = true

      const newRoots = new Set<string>()
      const newChangedFiles: Record<string, GitChangedFile[]> = {}
      const newDiffStats: Record<string, DiffStats> = {}

      try {
        for (const folderPath of folderPaths) {
          try {
            const isRoot = await git.checkIsRoot(folderPath)
            if (isRoot) {
              newRoots.add(folderPath)

              const statusMap = forceRefresh
                ? await git.refreshStatus(folderPath)
                : await git.getStatus(folderPath)
              if (statusMap) {
                const allPaths: string[] = []
                const normalizedFolder = normalizePath(folderPath)
                for (const [absPath, status] of Object.entries(statusMap)) {
                  const normalizedPath = normalizePath(absPath)
                  if (
                    normalizedPath.startsWith(`${normalizedFolder}/`) &&
                    normalizedPath !== normalizedFolder &&
                    status !== 'none' &&
                    status !== 'ignored'
                  ) {
                    allPaths.push(normalizedPath)
                  }
                }
                const leafPaths = allPaths.filter(
                  (p) =>
                    !allPaths.some(
                      (other) => other !== p && other.startsWith(`${p}/`),
                    ),
                )
                // Build a lookup map with normalized keys so we can
                // reliably index into it regardless of the original
                // path separator style from the main process.
                const normalizedStatusMap: Record<string, string> = {}
                for (const [k, v] of Object.entries(statusMap)) {
                  normalizedStatusMap[normalizePath(k)] = v
                }
                const changed: GitChangedFile[] = leafPaths.map(
                  (normalizedPath) => ({
                    name: normalizedPath.split('/').pop() || normalizedPath,
                    path: normalizedPath,
                    status: normalizedStatusMap[normalizedPath],
                  }),
                )
                if (changed.length > 0) {
                  newChangedFiles[folderPath] = changed.sort((a, b) =>
                    a.name.localeCompare(b.name),
                  )
                }
              }

              const stats = await git.getDiffStats(folderPath)
              if (stats) {
                Object.assign(newDiffStats, stats)
              }
            }
          } catch (e) {
            console.error('[GitDiffView] Failed to check git status:', e)
          }
        }

        setGitRoots(newRoots)
        setGitChangedFiles(newChangedFiles)
        setDiffStats(newDiffStats)
      } finally {
        loadingRef.current = false
      }
    },
    [],
  )

  // Load git status when folders change (by content, not reference)
  useEffect(() => {
    if (folders.length > 0) {
      loadGitStatus(folders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadGitStatus, folders])

  // Listen for git status changes — stable callback to avoid listener thrashing
  // Uses _foldersKey (stable string) instead of `folders` (array ref) to avoid
  // constant re-registration of the event listener on every parent render.
  const handleGitStatusChanged = useCallback(
    (data: { root: string }) => {
      if (data?.root && prevFoldersRef.current.includes(data.root)) {
        loadGitStatus(prevFoldersRef.current)
      }
    },
    [loadGitStatus],
  )
  useViewEvent('git-status-changed', handleGitStatusChanged)

  // ─── Commit Flow ──────────────────────────────────────────────────────────

  const commitStateRef = useRef<CommitState | null>(null)

  const handleCommit = useCallback(async (root: string) => {
    const newState = { generating: true, message: '', root, error: null }
    commitStateRef.current = newState
    setCommitState(newState)
    try {
      const result = await gitMutations.commitGenerate(root)
      if (result.error) {
        const errState = { ...newState, generating: false, error: result.error }
        commitStateRef.current = errState
        setCommitState(errState)
        return
      }
      const msgState = {
        ...newState,
        generating: false,
        message: result.message || '',
      }
      commitStateRef.current = msgState
      setCommitState(msgState)
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      const errState = { ...newState, generating: false, error: errMsg }
      commitStateRef.current = errState
      setCommitState(errState)
    }
  }, [])

  const handleCommitConfirm = useCallback(async () => {
    const cs = commitStateRef.current
    if (!cs) return
    const result = await gitMutations.commitExecute(cs.root, cs.message)
    if (result.error) {
      const errState = { ...cs, error: result.error }
      commitStateRef.current = errState
      setCommitState(errState)
      return
    }
    commitStateRef.current = null
    setCommitState(null)
    // GIT_STATUS_CHANGED event will trigger refresh via handleGitStatusChanged
  }, [])

  const handleCommitCancel = useCallback(() => {
    commitStateRef.current = null
    setCommitState(null)
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  // Check if any folder has changes
  const hasAnyChanges = Object.keys(gitChangedFiles).length > 0

  if (!hasAnyChanges && gitRoots.size === 0) {
    // No folders are git repos — show nothing or minimal state
    return null
  }

  return (
    <div className={cn('space-y-1', className)}>
      {folders.map((path) => {
        const isGit = gitRoots.has(path)
        const changedFiles = gitChangedFiles[path]
        const folderName = path.split(/[/\\]/).pop() || path

        return (
          <div key={path} className="space-y-0.5">
            {showFolderHeaders && (
              /* Folder header */
              <div
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/5 border border-transparent text-sm text-foreground/80 overflow-hidden"
                title={path}
              >
                {isGit ? (
                  <GitBranch size={14} className="text-primary/50 shrink-0" />
                ) : (
                  <GitCommitHorizontal
                    size={14}
                    className="text-muted-foreground/30 shrink-0"
                  />
                )}
                <span className="truncate flex-1">{folderName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => loadGitStatus(folders, true)}
                  className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent/30"
                  title="Refresh git status"
                >
                  <RefreshCw size={12} />
                </Button>
                {!isGit && (
                  <span className="text-[10px] text-muted-foreground/40 italic shrink-0">
                    not a git repository
                  </span>
                )}
                {isGit && (!changedFiles || changedFiles.length === 0) && (
                  <span className="text-[10px] text-muted-foreground/40 italic shrink-0">
                    No changes
                  </span>
                )}
              </div>
            )}

            {/* "Not a git repo" indicator when showFolderHeaders is false */}
            {!showFolderHeaders && !isGit && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/40 italic">
                {folderName} — not a git repository
              </div>
            )}

            {/* "No changes" indicator when showFolderHeaders is false */}
            {!showFolderHeaders &&
              isGit &&
              (!changedFiles || changedFiles.length === 0) && (
                <div className="px-3 py-2 text-[10px] text-muted-foreground/40 italic">
                  {folderName} — No changes
                </div>
              )}

            {/* Changed files list */}
            {isGit && changedFiles && changedFiles.length > 0 && (
              <div
                className={
                  showFolderHeaders
                    ? 'ml-5 pl-4 border-l border-border/30 space-y-0.5'
                    : 'space-y-0.5'
                }
              >
                {changedFiles.map((file) => (
                  <FileItem
                    key={file.path}
                    file={file}
                    stat={diffStats[file.path]}
                    statusConfig={getStatusConfig(file.status)}
                    onSelect={(path) => onSelectFile?.(path)}
                  />
                ))}

                {/* Commit button */}
                <div className="pt-1 pl-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCommit(path)}
                    disabled={commitState?.generating}
                    className="text-[10px] px-2.5 py-1 rounded-md font-medium transition-all bg-primary/15 text-primary hover:bg-primary/25 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                  >
                    {commitState?.generating && commitState?.root === path
                      ? 'Generating...'
                      : `Commit (${folderName})`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Commit Modal */}
      {commitState && (
        <Modal
          isOpen
          onClose={handleCommitCancel}
          title="Commit Changes"
          size="md"
          footer={
            !commitState.generating ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCommitCancel}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-foreground/10 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCommitConfirm}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
                >
                  Commit
                </Button>
              </>
            ) : null
          }
        >
          <div className="space-y-3">
            {commitState.error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {commitState.error}
              </div>
            )}
            {commitState.generating ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-8 justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Generating commit message...
              </div>
            ) : (
              <textarea
                value={commitState.message}
                onChange={(e) =>
                  setCommitState((prev) =>
                    prev ? { ...prev, message: e.target.value } : null,
                  )
                }
                className="w-full h-24 bg-background border border-border/30 rounded-lg px-3 py-2 text-xs font-mono resize-none outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                placeholder="Commit message..."
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
