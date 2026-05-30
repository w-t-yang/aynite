import { FileCode, Folder, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { ai as aiBridge } from '../../bridge/ai'
import { config, configMutations } from '../../bridge/config'
import { file as bridgeFile } from '../../bridge/file'
import { workspace, workspaceMutations } from '../../bridge/workspace'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { ViewHeader } from '../../shared/basic/ViewHeader'
import { GitDiffView } from '../../shared/featured/GitDiffView'
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

export function WorkspaceView() {
  const [workspaceName, setWorkspaceName] = useState<string>('')
  const [folders, setFolders] = useState<string[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([])

  const loadData = useCallback(async () => {
    try {
      const [wsName, folderList, sessionList, activeId] = await Promise.all([
        config.get('activeWorkspace'),
        workspace.folders(),
        aiBridge.listSessions(),
        config.get('activeSessionId'),
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
      const status = await aiBridge.getArtifactsStatus()
      if (!status?.memory?.path) {
        setArtifacts([])
        return
      }
      // Derive the artifacts directory path from memory.md path
      const artifactsDir = status.memory.path.replace(/\/[^/]+$/, '')
      const files = await bridgeFile.list(artifactsDir)
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

  const handleAddFolder = useCallback(async () => {
    try {
      await workspaceMutations.addFolder()
      loadData()
    } catch (e: any) {
      console.error('[WorkspaceView] Failed to add folder:', e)
    }
  }, [loadData])

  useEffect(() => {
    loadData()
    loadArtifacts()
  }, [loadData, loadArtifacts])

  // Listen for session changes from other views (like AIChat creating a new one)
  useAppEvent('active-session-changed', (data: { id: string }) => {
    setActiveSessionId(data.id)
  })

  // Listen for config changes
  useAppEvent('config-changed', () => {
    loadData()
    loadArtifacts()
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
      await configMutations.set('activeSessionId', id)
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
      await configMutations.set('session-delete', sessionToDelete.id)
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
              <GitDiffView
                folders={folders}
                onSelectFile={(path) => configMutations.set('activeFile', path)}
              />
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
                  onClick={() => configMutations.set('activeFile', file.path)}
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
                configMutations.set('activeSessionId', Date.now().toString())
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
      </div>
    </div>
  )
}
