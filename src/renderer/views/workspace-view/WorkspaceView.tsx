import {
  FileCode,
  Folder,
  GitBranch,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { ViewHeader } from '../../shared/basic/ViewHeader'
import { cn } from '../../shared/lib/utils'
import { useAppEvent } from '../ViewContext'

interface Session {
  id: string
  date: string
  title: string
  preview: string
  lastModified: string
  messageCount: number
}

interface ArtifactFile {
  name: string
  path: string
}

interface GitChangedFile {
  name: string
  path: string
  status: string
}

export function WorkspaceView() {
  const [workspaceName, setWorkspaceName] = useState<string>('')
  const [folders, setFolders] = useState<string[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([])
  const [gitRoots, setGitRoots] = useState<Set<string>>(new Set())
  const [gitChangedFiles, setGitChangedFiles] = useState<
    Record<string, GitChangedFile[]>
  >({})

  const loadData = useCallback(async () => {
    try {
      const [wsName, folderList, sessionList, activeId] = await Promise.all([
        window.aynite.getConfig('activeWorkspace'),
        window.aynite.getWorkspaceFolders(),
        window.aynite.listSessions(),
        window.aynite.getConfig('activeSessionId'),
      ])
      setWorkspaceName(wsName || '')
      setFolders(folderList || [])
      setSessions(sessionList || [])
      setActiveSessionId(activeId)
    } catch (e) {
      console.error('[WorkspaceView] Failed to load data:', e)
    }
  }, [])

  const loadArtifacts = useCallback(async () => {
    try {
      const status = await window.aynite.getArtifactsStatus()
      if (!status?.memory?.path) {
        setArtifacts([])
        return
      }
      // Derive the artifacts directory path from memory.md path
      const artifactsDir = status.memory.path.replace(/\/[^/]+$/, '')
      const files = await window.aynite.listFolder(artifactsDir)
      setArtifacts(
        files
          .filter((f: any) => !f.isDirectory)
          .map((f: any) => ({ name: f.name, path: f.path })),
      )
    } catch (e) {
      console.error('[WorkspaceView] Failed to load artifacts:', e)
      setArtifacts([])
    }
  }, [])

  const loadGitStatus = useCallback(async (folderPaths: string[]) => {
    const newRoots = new Set<string>()
    const newChangedFiles: Record<string, GitChangedFile[]> = {}

    for (const folderPath of folderPaths) {
      try {
        const isRoot = await window.aynite.checkIsGitRoot(folderPath)
        if (isRoot) {
          newRoots.add(folderPath)
          const statusMap = await window.aynite.getGitStatus(folderPath)
          if (statusMap) {
            // Collect all changed file paths under this root
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
            // Filter out parent directory entries (paths that are a prefix
            // of another changed path) — same heuristic as treeview
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
        }
      } catch (e) {
        console.error('[WorkspaceView] Failed to check git status:', e)
      }
    }

    setGitRoots(newRoots)
    setGitChangedFiles(newChangedFiles)
  }, [])

  // ─── Commit State ────────────────────────────────────────────────────
  const [commitState, setCommitState] = useState<{
    generating: boolean
    message: string
    root: string
    error: string | null
  } | null>(null)

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

  const handleAddFolder = useCallback(async () => {
    try {
      await window.aynite.addWorkspaceFolder()
      loadData()
    } catch (e: any) {
      console.error('[WorkspaceView] Failed to add folder:', e)
    }
  }, [loadData])

  const handleRemoveFolder = useCallback(
    async (path: string) => {
      try {
        await window.aynite.removeWorkspaceFolder(path)
        loadData()
      } catch (e: any) {
        console.error('[WorkspaceView] Failed to remove folder:', e)
      }
    },
    [loadData],
  )

  useEffect(() => {
    loadData()
    loadArtifacts()
  }, [loadData, loadArtifacts])

  // Load git status for folders when folders change
  useEffect(() => {
    if (folders.length > 0) {
      loadGitStatus(folders)
    }
  }, [folders, loadGitStatus])

  // Listen for session changes from other views (like AIChat creating a new one)
  useAppEvent('active-session-changed', (data: { id: string }) => {
    setActiveSessionId(data.id)
  })

  // Listen for config changes
  useAppEvent('config-changed', () => {
    loadData()
    loadArtifacts()
  })

  // Listen for git status changes to refresh changed files
  useAppEvent('git-status-changed', (data: { root: string }) => {
    if (data?.root && folders.includes(data.root)) {
      loadGitStatus(folders)
    }
  })

  useAppEvent('session-deleted', () => {
    loadData()
  })

  useAppEvent('session-saved', () => {
    loadData()
    loadArtifacts()
  })

  const handleSelectSession = async (id: string) => {
    try {
      await window.aynite.setConfig('activeSessionId', id)
      setActiveSessionId(id)
    } catch (e) {
      console.error('[WorkspaceView] Failed to set active session:', e)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation()
    setSessionToDelete(session)
  }

  const confirmDelete = async () => {
    if (!sessionToDelete) return
    try {
      await window.aynite.setConfig('session-delete', sessionToDelete.id)
      setSessionToDelete(null)
      // loadData will be called by the event listener
    } catch (e) {
      console.error('[WorkspaceView] Failed to delete session:', e)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader
        icon={<MessageSquare size={16} />}
        title={`Workspace - ${workspaceName || '...'}`}
      />
      <div className="flex-1 overflow-auto p-4 space-y-8">
        {/* Folders Group */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            <div className="flex items-center gap-2">
              <Folder size={14} />
              <span>Folders</span>
            </div>
            <button
              type="button"
              onClick={handleAddFolder}
              className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors"
              title="Add Folder to Workspace"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {folders.length === 0 ? (
              <div className="text-xs text-muted-foreground/40 italic px-2">
                No folders added
              </div>
            ) : (
              folders.map((path) => {
                const isGit = gitRoots.has(path)
                const changedFiles = gitChangedFiles[path]
                const folderName = path.split(/[/\\]/).pop()
                return (
                  <div key={path} className="space-y-0.5">
                    <div
                      className="group flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/5 border border-transparent text-sm text-foreground/80 overflow-hidden"
                      title={path}
                    >
                      <Folder
                        size={14}
                        className="text-muted-foreground/50 shrink-0"
                      />
                      <span className="truncate flex-1">{folderName}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isGit && (
                          <GitBranch
                            size={12}
                            className="text-primary/50"
                            title="Git repository"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFolder(path)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive"
                          title="Remove folder from workspace"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    {changedFiles && changedFiles.length > 0 && (
                      <div className="ml-5 pl-4 border-l border-border/30 space-y-0.5">
                        {changedFiles.map((file) => (
                          <button
                            key={file.path}
                            type="button"
                            onClick={() =>
                              window.aynite.setConfig('activeFile', file.path)
                            }
                            className="w-full group flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-foreground/70 hover:bg-accent/10 hover:text-foreground transition-all text-left"
                            title={file.path}
                          >
                            <span
                              className={`text-[10px] font-bold font-mono shrink-0 w-5 ${
                                file.status === 'modified'
                                  ? 'text-amber-400'
                                  : file.status === 'added'
                                    ? 'text-green-400'
                                    : file.status === 'untracked'
                                      ? 'text-blue-400'
                                      : file.status === 'deleted'
                                        ? 'text-red-400'
                                        : 'text-muted-foreground'
                              }`}
                            >
                              {file.status === 'modified'
                                ? 'M'
                                : file.status === 'added'
                                  ? 'A'
                                  : file.status === 'untracked'
                                    ? 'U'
                                    : file.status === 'deleted'
                                      ? 'D'
                                      : '?'}
                            </span>
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                        {isGit && changedFiles.length > 0 && (
                          <div className="pt-1 pl-1">
                            <button
                              type="button"
                              onClick={() => handleCommit(path)}
                              disabled={commitState?.generating}
                              className="text-[10px] px-2.5 py-1 rounded-md font-medium transition-all bg-primary/15 text-primary hover:bg-primary/25 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                            >
                              {commitState?.generating
                                ? 'Generating...'
                                : `Commit (${folderName})`}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Workspace Artifacts Group */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            <FileCode size={14} />
            <span>Artifacts</span>
          </div>
          <div className="space-y-1">
            {artifacts.length === 0 ? (
              <div className="text-xs text-muted-foreground/40 italic px-2">
                No artifacts found
              </div>
            ) : (
              artifacts.map((file) => (
                <Button
                  key={file.path}
                  variant="ghost"
                  onClick={() =>
                    window.aynite.setConfig('activeFile', file.path)
                  }
                  className="w-full group flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent text-sm text-foreground/80 overflow-hidden transition-all hover:bg-accent/10 hover:border-border/50 text-left h-auto"
                  title={file.path}
                >
                  <FileCode
                    size={14}
                    className="text-muted-foreground/40 shrink-0"
                  />
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open
                  </span>
                </Button>
              ))
            )}
          </div>
        </section>

        {/* Sessions Group */}
        <section className="space-y-3 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} />
              <span>Sessions</span>
            </div>
            <button
              type="button"
              onClick={() =>
                window.aynite.setConfig(
                  'activeSessionId',
                  Date.now().toString(),
                )
              }
              className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors"
              title="New Session"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
            {sessions.length === 0 ? (
              <div className="text-xs text-muted-foreground/40 italic px-2">
                No sessions found
              </div>
            ) : (
              sessions.map((session) => {
                const isActive = session.id === activeSessionId
                const date = new Date(session.lastModified).toLocaleDateString(
                  undefined,
                  {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  },
                )

                return (
                  <Button
                    key={session.id}
                    variant="ghost"
                    onClick={() => handleSelectSession(session.id)}
                    className={cn(
                      'w-full group flex flex-col items-start gap-1.5 px-3 py-3 rounded-lg border transition-all text-left h-auto p-3',
                      isActive
                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20 hover:bg-primary/10'
                        : 'bg-accent/5 border-transparent hover:bg-accent/10 hover:border-border/50',
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={cn(
                          'text-sm font-semibold truncate',
                          isActive ? 'text-primary' : 'text-foreground/90',
                        )}
                      >
                        {session.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 shrink-0 uppercase tracking-tighter">
                        {date}
                      </span>
                    </div>
                    <div className="flex items-center justify-between w-full gap-3">
                      <span className="text-[11px] text-muted-foreground/60 line-clamp-2 leading-relaxed flex-1">
                        {session.preview}
                      </span>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-end pb-0.5">
                        <Trash2
                          size={12}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                          onClick={(e) => handleDeleteSession(e, session)}
                        />
                      </div>
                    </div>
                  </Button>
                )
              })
            )}
          </div>
        </section>

        {/* Footer hint */}
        <div className="pt-2 border-t border-border/30 text-[10px] text-muted-foreground/30 text-center">
          Selecting a session updates the AI Chat view
        </div>

        <Modal
          isOpen={!!sessionToDelete}
          onClose={() => setSessionToDelete(null)}
          title="Delete Session"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSessionToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-none"
                onClick={confirmDelete}
              >
                Delete Session
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Are you sure you want to delete this session? This action cannot
              be undone.
            </p>
            {sessionToDelete && (
              <div className="p-3 rounded-lg bg-accent/10 border border-border/40 text-xs text-muted-foreground italic">
                "{sessionToDelete.title}"
              </div>
            )}
          </div>
        </Modal>

        {/* Commit Modal */}
        {commitState && (
          <Modal
            isOpen
            onClose={() => setCommitState(null)}
            title="Commit Changes"
            size="md"
            footer={
              !commitState.generating ? (
                <>
                  <Button variant="ghost" onClick={() => setCommitState(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCommitConfirm}>
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
    </div>
  )
}
