import { GitBranch, GitCommitHorizontal, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { DiffStats } from '../../../lib/types/files'
import { useAppEvent } from '../../views/ViewContext'
import { Modal } from '../basic/Modal'
import { cn } from '../lib/utils'

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

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const loadGitStatus = useCallback(
    async (folderPaths: string[], forceRefresh = false) => {
      const newRoots = new Set<string>()
      const newChangedFiles: Record<string, GitChangedFile[]> = {}
      const newDiffStats: Record<string, DiffStats> = {}

      for (const folderPath of folderPaths) {
        try {
          const isRoot = await (window as any).aynite.checkIsGitRoot(folderPath)
          if (isRoot) {
            newRoots.add(folderPath)

            // Use force-refresh API when called from refresh button,
            // otherwise use cached status (faster for initial load)
            const statusMap = forceRefresh
              ? await (window as any).aynite.refreshGitStatus(folderPath)
              : await (window as any).aynite.getGitStatus(folderPath)
            if (statusMap) {
              const allPaths: string[] = []
              for (const [absPath, status] of Object.entries(statusMap)) {
                if (
                  absPath.startsWith(`${folderPath}/`) &&
                  absPath !== folderPath &&
                  status !== 'none' &&
                  status !== 'ignored'
                ) {
                  allPaths.push(absPath)
                }
              }
              // Filter out parent directory entries
              const leafPaths = allPaths.filter(
                (p) =>
                  !allPaths.some(
                    (other) => other !== p && other.startsWith(`${p}/`),
                  ),
              )
              const changed: GitChangedFile[] = leafPaths.map((absPath) => ({
                name: absPath.split('/').pop() || absPath,
                path: absPath,
                status: statusMap[absPath],
              }))
              if (changed.length > 0) {
                newChangedFiles[folderPath] = changed.sort((a, b) =>
                  a.name.localeCompare(b.name),
                )
              }
            }

            // Fetch diff stats
            const stats = await (window as any).aynite.getGitDiffStats(
              folderPath,
            )
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
    },
    [],
  )

  // Load git status when folders change
  useEffect(() => {
    if (folders.length > 0) {
      loadGitStatus(folders)
    }
  }, [folders, loadGitStatus])

  // Listen for git status changes
  useAppEvent('git-status-changed', (data: { root: string }) => {
    if (data?.root && folders.includes(data.root)) {
      loadGitStatus(folders)
    }
  })

  // ─── Commit Flow ──────────────────────────────────────────────────────────

  const handleCommit = useCallback(async (root: string) => {
    setCommitState({ generating: true, message: '', root, error: null })
    try {
      const result = await (window as any).aynite.commitGenerate(root)
      if (result.error) {
        setCommitState((prev) =>
          prev ? { ...prev, generating: false, error: result.error } : null,
        )
        return
      }
      setCommitState((prev) =>
        prev
          ? { ...prev, generating: false, message: result.message || '' }
          : null,
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setCommitState((prev) =>
        prev ? { ...prev, generating: false, error: msg } : null,
      )
    }
  }, [])

  const handleCommitConfirm = useCallback(async () => {
    if (!commitState) return
    const result = await (window as any).aynite.commitExecute(
      commitState.root,
      commitState.message,
    )
    if (result.error) {
      setCommitState((prev) => (prev ? { ...prev, error: result.error } : null))
      return
    }
    setCommitState(null)
    // Refresh git status
    loadGitStatus(folders)
  }, [commitState, loadGitStatus, folders])

  const handleCommitCancel = useCallback(() => {
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
                <button
                  type="button"
                  onClick={() => loadGitStatus(folders, true)}
                  className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent/30 transition-all"
                  title="Refresh git status"
                >
                  <RefreshCw size={12} />
                </button>
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
                {changedFiles.map((file) => {
                  const stat = diffStats[file.path]
                  const config = getStatusConfig(file.status)
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => onSelectFile?.(file.path)}
                      className="w-full group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-foreground/70 hover:bg-accent/10 hover:text-foreground transition-all text-left"
                      title={file.path}
                    >
                      <span
                        className={`text-[10px] font-bold font-mono shrink-0 w-5 ${config.className}`}
                      >
                        {config.letter}
                      </span>
                      <span className="truncate flex-1">{file.name}</span>
                      {stat && (
                        <span className="text-[10px] font-mono leading-none whitespace-nowrap shrink-0">
                          {stat.additions > 0 && (
                            <span className="text-green-500">
                              +{stat.additions}
                            </span>
                          )}
                          {stat.additions > 0 && stat.deletions > 0 && (
                            <span className="text-muted-foreground/40"> </span>
                          )}
                          {stat.deletions > 0 && (
                            <span className="text-red-500">
                              -{stat.deletions}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  )
                })}

                {/* Commit button */}
                <div className="pt-1 pl-1">
                  <button
                    type="button"
                    onClick={() => handleCommit(path)}
                    disabled={commitState?.generating}
                    className="text-[10px] px-2.5 py-1 rounded-md font-medium transition-all bg-primary/15 text-primary hover:bg-primary/25 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                  >
                    {commitState?.generating && commitState?.root === path
                      ? 'Generating...'
                      : `Commit (${folderName})`}
                  </button>
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
                <button
                  type="button"
                  onClick={handleCommitCancel}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-foreground/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitConfirm}
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
                >
                  Commit
                </button>
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
