import {
  ArrowDownToLine,
  ArrowUpToLine,
  GitBranch,
  GitCommitHorizontal,
  RefreshCw,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { DiffStats } from '../../../lib/types/files'
import { git, gitMutations } from '../../bridge/git'
import { useViewEvent } from '../../views/useViewEvents'
import { Button } from '../basic/Button'
import { Modal } from '../basic/Modal'
import { cn, normalizePath } from '../lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GitChangedFile {
  path: string
  relativePath: string
  status: string
}

interface CommitState {
  generating: boolean
  committing: boolean
  message: string
  root: string
  error: string | null
}

interface GitDiffViewProps {
  /** List of workspace folder paths to check for git status */
  folders: string[]
  /** Callback when a changed file is clicked */
  onSelectFile?: (path: string) => void
  /** Callback when a project folder header is clicked */
  onSelectFolder?: (path: string) => void
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
  /** Action button to show on the right (stage/unstage) */
  actionButton?: React.ReactNode
}

const FileItem = React.memo(function FileItem({
  file,
  stat,
  statusConfig,
  onSelect,
  actionButton,
}: FileItemProps) {
  return (
    <div className="flex items-center gap-1 group px-1 rounded-lg hover:bg-accent/5 transition-colors">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSelect(file.path)}
        className="flex-1 justify-start text-left hover:bg-transparent h-auto min-h-0 py-1.5 px-2"
        title={file.path}
      >
        <span
          className={`text-[10px] font-bold font-mono shrink-0 w-5 ${statusConfig.className}`}
        >
          {statusConfig.letter}
        </span>
        <span className="truncate flex-1 text-xs font-mono text-foreground/80">
          {file.relativePath}
        </span>
        {stat && (
          <span className="text-[10px] font-mono leading-none whitespace-nowrap shrink-0 ml-2">
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
      {actionButton && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {actionButton}
        </div>
      )}
    </div>
  )
})

// ─── Split Status State ─────────────────────────────────────────────────────

interface FolderSplitStatus {
  staged: GitChangedFile[]
  unstaged: GitChangedFile[]
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GitDiffView({
  folders,
  onSelectFile,
  onSelectFolder,
  className,
  showFolderHeaders = true,
}: GitDiffViewProps) {
  const [gitRoots, setGitRoots] = useState<Set<string>>(new Set())
  const [splitStatus, setSplitStatus] = useState<
    Record<string, FolderSplitStatus>
  >({})
  const [diffStats, setDiffStats] = useState<Record<string, DiffStats>>({})
  const [commitState, setCommitState] = useState<CommitState | null>(null)
  const [noStagedModal, setNoStagedModal] = useState<string | null>(null)

  // ─── Stable folders key ───────────────────────────────────────────────────
  const prevFoldersRef = useRef<string[]>([])
  if (
    prevFoldersRef.current.length !== folders.length ||
    prevFoldersRef.current.some((f, i) => f !== folders[i])
  ) {
    prevFoldersRef.current = folders
  }

  // Guard against concurrent loadGitStatus calls
  const loadingRef = useRef(false)

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const loadGitStatus = useCallback(
    async (folderPaths: string[], forceRefresh = false) => {
      if (loadingRef.current) return
      loadingRef.current = true

      const newRoots = new Set<string>()
      const newSplitStatus: Record<string, FolderSplitStatus> = {}
      const newDiffStats: Record<string, DiffStats> = {}

      try {
        for (const folderPath of folderPaths) {
          try {
            const isRoot = await git.checkIsRoot(folderPath)
            if (isRoot) {
              newRoots.add(folderPath)

              // Get split status (staged vs unstaged)
              const split = forceRefresh
                ? await git
                    .refreshStatus(folderPath)
                    .then(() => git.getSplitStatus(folderPath))
                : await git.getSplitStatus(folderPath)

              if (split) {
                const normalizedFolder = normalizePath(folderPath)

                const toChangedFiles = (
                  map: Record<string, string>,
                ): GitChangedFile[] => {
                  const result: GitChangedFile[] = []
                  for (const [absPath, status] of Object.entries(map)) {
                    const normalizedPath = normalizePath(absPath)
                    if (
                      normalizedPath.startsWith(`${normalizedFolder}/`) &&
                      normalizedPath !== normalizedFolder
                    ) {
                      result.push({
                        path: normalizedPath,
                        relativePath: normalizedPath.slice(
                          normalizedFolder.length + 1,
                        ),
                        status,
                      })
                    }
                  }
                  return result.sort((a, b) =>
                    a.relativePath.localeCompare(b.relativePath),
                  )
                }

                newSplitStatus[folderPath] = {
                  staged: toChangedFiles(split.staged || {}),
                  unstaged: toChangedFiles(split.unstaged || {}),
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
        setSplitStatus(newSplitStatus)
        setDiffStats(newDiffStats)
      } finally {
        loadingRef.current = false
      }
    },
    [],
  )

  // Load git status when folders change
  useEffect(() => {
    if (folders.length > 0) {
      loadGitStatus(folders)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadGitStatus, folders])

  // Listen for git status changes — reload all tracked folders on any event
  const handleGitStatusChanged = useCallback(
    (_data: { root: string }) => {
      if (prevFoldersRef.current.length > 0) {
        loadGitStatus(prevFoldersRef.current)
      }
    },
    [loadGitStatus],
  )
  useViewEvent('git-status-changed', handleGitStatusChanged)

  // ─── Stage / Unstage Handlers ─────────────────────────────────────────────

  const handleStageFile = useCallback(
    async (filePath: string) => {
      await gitMutations.stageFile(filePath)
      // Manually reload after mutation — the git-status-changed event should
      // also trigger a reload via handleGitStatusChanged, but we do it here
      // to guarantee the UI updates even if the event relay is delayed.
      loadGitStatus(prevFoldersRef.current)
    },
    [loadGitStatus],
  )

  const handleUnstageFile = useCallback(
    async (filePath: string) => {
      await gitMutations.unstageFile(filePath)
      loadGitStatus(prevFoldersRef.current)
    },
    [loadGitStatus],
  )

  const handleStageAll = useCallback(
    async (root: string) => {
      await gitMutations.stageAll(root)
      loadGitStatus(prevFoldersRef.current)
    },
    [loadGitStatus],
  )

  // ─── Commit Flow ──────────────────────────────────────────────────────────

  const commitStateRef = useRef<CommitState | null>(null)

  const handleCommit = useCallback(
    async (root: string) => {
      const status = splitStatus[root]
      const stagedCount = status?.staged?.length ?? 0

      if (stagedCount === 0) {
        setNoStagedModal(root)
        return
      }

      const newState = {
        generating: true,
        committing: false,
        message: '',
        root,
        error: null,
      }
      commitStateRef.current = newState
      setCommitState(newState)
      try {
        const result = await gitMutations.commitGenerate(root)
        if (result.error) {
          const errState = {
            ...newState,
            generating: false,
            error: result.error,
          }
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
    },
    [splitStatus],
  )

  const handleCommitConfirm = useCallback(async () => {
    const cs = commitStateRef.current
    if (!cs || cs.committing) return
    const committingState = { ...cs, committing: true, error: null }
    commitStateRef.current = committingState
    setCommitState(committingState)
    try {
      const result = await gitMutations.commitExecute(cs.root, cs.message)
      if (result.error) {
        const isPreCommit =
          result.error.includes('pre-commit') ||
          result.error.includes('hook') ||
          result.error.toLowerCase().includes('lint') ||
          result.error.toLowerCase().includes('eslint') ||
          result.error.toLowerCase().includes('prettier')
        const errState = {
          ...committingState,
          committing: false,
          error: isPreCommit
            ? 'Commit failed. Fix the issues reported by pre-commit hooks and try again.'
            : result.error,
        }
        commitStateRef.current = errState
        setCommitState(errState)
        return
      }
      commitStateRef.current = null
      setCommitState(null)
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      const errState = { ...committingState, committing: false, error: errMsg }
      commitStateRef.current = errState
      setCommitState(errState)
    }
  }, [])

  const handleCommitCancel = useCallback(() => {
    commitStateRef.current = null
    setCommitState(null)
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasAnyChanges = Object.values(splitStatus).some(
    (s) => s.staged.length > 0 || s.unstaged.length > 0,
  )

  if (!hasAnyChanges && gitRoots.size === 0) {
    return null
  }

  return (
    <div className={cn('space-y-1', className)}>
      {folders.map((folderPath) => {
        const isGit = gitRoots.has(folderPath)
        const status = splitStatus[folderPath]
        const stagedFiles = status?.staged ?? []
        const unstagedFiles = status?.unstaged ?? []
        const folderName = folderPath.split(/[/\\]/).pop() || folderPath
        const hasChanges = stagedFiles.length > 0 || unstagedFiles.length > 0

        return (
          <div key={folderPath} className="space-y-0.5">
            {/* ── Folder Header ── */}
            {showFolderHeaders && (
              <button
                type="button"
                onClick={() => onSelectFolder?.(folderPath)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/5 border border-transparent text-sm text-foreground/80 overflow-hidden hover:bg-accent/10 hover:border-border/40 transition-all cursor-pointer text-left"
                title={folderPath}
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

                {/* Refresh button — only for git repos */}
                {isGit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => loadGitStatus(folders, true)}
                    className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent/30"
                    title="Refresh git status"
                  >
                    <RefreshCw size={12} />
                  </Button>
                )}

                {!isGit && (
                  <span className="text-[10px] text-muted-foreground/40 italic shrink-0">
                    not a git repository
                  </span>
                )}
                {isGit && !hasChanges && (
                  <span className="text-[10px] text-muted-foreground/40 italic shrink-0">
                    No changes
                  </span>
                )}
              </button>
            )}

            {/* "Not a git repo" when showFolderHeaders is false */}
            {!showFolderHeaders && !isGit && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/40 italic">
                {folderName} — not a git repository
              </div>
            )}

            {/* "No changes" when showFolderHeaders is false */}
            {!showFolderHeaders && isGit && !hasChanges && (
              <div className="px-3 py-2 text-[10px] text-muted-foreground/40 italic">
                {folderName} — No changes
              </div>
            )}

            {/* ── Changed Files ── */}
            {isGit && hasChanges && (
              <div
                className={
                  showFolderHeaders
                    ? 'ml-5 pl-4 border-l border-border/30 space-y-1'
                    : 'space-y-1'
                }
              >
                {/* ── Staged Section ── */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-green-500/70">
                      Staged
                    </span>
                    <span className="text-[9px] text-muted-foreground/40 font-mono">
                      {stagedFiles.length}
                    </span>
                    {/* Unstage all button — only when there are staged files */}
                    {stagedFiles.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          gitMutations
                            .unstageAll(folderPath)
                            .then(() => loadGitStatus(prevFoldersRef.current))
                        }}
                        className="ml-auto p-0.5 h-5 w-5 rounded text-muted-foreground/40 hover:text-amber-400 hover:bg-accent/20"
                        title="Unstage all — remove all files from the staging area"
                      >
                        <ArrowDownToLine size={10} />
                      </Button>
                    )}
                  </div>
                  {stagedFiles.length > 0 ? (
                    <>
                      {stagedFiles.map((file) => (
                        <FileItem
                          key={file.path}
                          file={file}
                          stat={diffStats[file.path]}
                          statusConfig={getStatusConfig(file.status)}
                          onSelect={(path) => onSelectFile?.(path)}
                          actionButton={
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleUnstageFile(file.path)
                              }}
                              className="p-0.5 h-5 w-5 rounded text-muted-foreground/40 hover:text-amber-400 hover:bg-accent/20"
                              title="Unstage — remove from staging area"
                            >
                              <ArrowDownToLine size={10} />
                            </Button>
                          }
                        />
                      ))}
                      {/* Commit button — only when there are staged files */}
                      <div className="pt-1 pl-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCommit(folderPath)}
                          disabled={commitState?.generating}
                          className="text-[10px] px-2.5 py-1 rounded-md font-medium transition-all bg-primary/15 text-primary hover:bg-primary/25 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                        >
                          {commitState?.generating &&
                          commitState?.root === folderPath ? (
                            <span className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                              Generating...
                            </span>
                          ) : (
                            `Commit (${folderName})`
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* No staged files — disabled commit with hint */
                    <div className="pl-2 pt-1 space-y-1">
                      <p className="text-[10px] text-muted-foreground/50 italic">
                        No staged changes
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="text-[10px] px-2.5 py-1 rounded-md font-medium bg-muted text-muted-foreground cursor-not-allowed"
                      >
                        Commit ({folderName})
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Unstaged Section ── */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-500/70">
                      Unstaged
                    </span>
                    <span className="text-[9px] text-muted-foreground/40 font-mono">
                      {unstagedFiles.length}
                    </span>
                    {/* Stage all button — only when there are unstaged files */}
                    {unstagedFiles.length > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStageAll(folderPath)}
                        className="ml-auto p-0.5 h-5 w-5 rounded text-muted-foreground/40 hover:text-green-400 hover:bg-accent/20"
                        title="Stage all — add all unstaged changes to the staging area"
                      >
                        <ArrowUpToLine size={10} />
                      </Button>
                    )}
                  </div>
                  {unstagedFiles.length > 0 ? (
                    unstagedFiles.map((file) => (
                      <FileItem
                        key={file.path}
                        file={file}
                        stat={diffStats[file.path]}
                        statusConfig={getStatusConfig(file.status)}
                        onSelect={(path) => onSelectFile?.(path)}
                        actionButton={
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStageFile(file.path)
                            }}
                            className="p-0.5 h-5 w-5 rounded text-muted-foreground/40 hover:text-green-400 hover:bg-accent/20"
                            title="Stage — add this file to the staging area"
                          >
                            <ArrowUpToLine size={10} />
                          </Button>
                        }
                      />
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-[10px] text-muted-foreground/40 italic">
                      All changes are staged
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Nothing to Commit Modal ── */}
      <Modal
        isOpen={!!noStagedModal}
        onClose={() => setNoStagedModal(null)}
        title="Nothing to Commit"
        size="sm"
        footer={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setNoStagedModal(null)}
            className="text-xs px-3 py-1.5 rounded-lg"
          >
            OK
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground/80 leading-relaxed">
            There are no staged changes to commit. Stage your changes first
            using the stage buttons, then try again.
          </p>
        </div>
      </Modal>

      {/* ── Commit Modal ── */}
      {commitState && (
        <Modal
          isOpen
          onClose={handleCommitCancel}
          title="Commit Changes"
          size="md"
          footer={
            commitState.committing ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center w-full">
                <span className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                Committing...
              </div>
            ) : !commitState.generating ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCommitCancel}
                  disabled={commitState.committing}
                  className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-foreground/10 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCommitConfirm}
                  disabled={commitState.committing}
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
            {commitState.committing ? (
              <div className="text-xs text-muted-foreground/70 italic py-8 text-center">
                Committing changes (pre-commit hooks may take a moment)...
              </div>
            ) : commitState.generating ? (
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
