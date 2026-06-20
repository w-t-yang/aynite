import { FileCode, Folder, MessageSquare, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ai as aiBridge } from '../../bridge/ai'
import { config, configMutations } from '../../bridge/config'
import { file as bridgeFile } from '../../bridge/file'
import { workspace, workspaceMutations } from '../../bridge/workspace'
import { Button } from '../../shared/basic/Button'
import { Modal } from '../../shared/basic/Modal'
import { SessionCard, type SessionEntry } from '../../shared/basic/SessionCard'
import { GitDiffView } from '../../shared/featured/GitDiffView'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { normalizePath } from '../../shared/lib/utils'
import { useViewEvent } from '../useViewEvents'
import { useView } from '../ViewContext'
import viewConfig from './config.json'

const INITIAL_SESSION_LIMIT = 10

interface ArtifactFile {
  name: string
  path: string
}

export function WorkspaceView() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

  const [folders, setFolders] = useState<string[]>([])
  const [allSessions, setAllSessions] = useState<SessionEntry[]>([])
  const [visibleCount, setVisibleCount] = useState(INITIAL_SESSION_LIMIT)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<SessionEntry | null>(
    null,
  )
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([])

  const loadData = useCallback(async () => {
    try {
      const [folderList, sessionList, activeId] = await Promise.all([
        workspace.folders(),
        aiBridge.listSessions(),
        config.get('activeSessionId'),
      ])
      setFolders(folderList || [])
      const filtered = (sessionList || []).filter(
        (s: SessionEntry) => !s.title?.startsWith('Compact backup'),
      )
      setAllSessions(filtered)
      setActiveSessionId(activeId)
      setVisibleCount(INITIAL_SESSION_LIMIT)
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
      const normalizedPath = normalizePath(status.memory.path)
      const artifactsDir = normalizedPath.replace(/\/[^/]+$/, '')
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

  useViewEvent('active-session-changed', (data: { id: string }) => {
    setActiveSessionId(data.id)
  })

  useViewEvent('config-changed', () => {
    loadData()
    loadArtifacts()
  })

  useViewEvent('session-deleted', () => {
    loadData()
  })

  useViewEvent('session-saved', () => {
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

  const handleDeleteSession = (session: SessionEntry) => {
    setSessionToDelete(session)
  }

  const confirmDelete = async () => {
    if (!sessionToDelete) return
    try {
      await configMutations.set('session-delete', sessionToDelete.id)
      setSessionToDelete(null)
    } catch (e) {
      console.error('[WorkspaceView] Failed to delete session:', e)
    }
  }

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + INITIAL_SESSION_LIMIT)
  }

  const handleNewSession = async () => {
    const newId = Date.now().toString()
    try {
      const { aiMutations } = await import('../../bridge/ai')
      await aiMutations.saveSession(newId, [])
    } catch (e) {
      console.error('[WorkspaceView] Failed to create session:', e)
    }
    configMutations.set('activeSessionId', newId)
  }

  // Sessions displayed (most recent first), limited by visibleCount
  const sessions = allSessions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
    )
    .slice(0, visibleCount)

  const hasMoreSessions = visibleCount < allSessions.length

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-1 overflow-auto p-4 space-y-8">
        {/* ── Projects (Folders) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            <div className="flex items-center gap-2">
              <Folder size={14} />
              <span>{t('projects.title')}</span>
            </div>
            <button
              type="button"
              onClick={handleAddFolder}
              className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors"
              title={t('projects.addTitle')}
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {folders.length === 0 ? (
              <div className="text-xs text-muted-foreground/40 italic px-2">
                {t('projects.empty')}
              </div>
            ) : (
              <GitDiffView
                folders={folders}
                onSelectFile={(path) => configMutations.set('activeFile', path)}
              />
            )}
          </div>
        </section>

        {/* ── Sessions ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} />
              <span>{t('sessions.title')}</span>
            </div>
            <button
              type="button"
              onClick={handleNewSession}
              className="p-1 rounded hover:bg-accent text-muted-foreground/50 hover:text-foreground transition-colors"
              title={t('sessions.newTitle')}
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {sessions.length === 0 ? (
              <div className="text-xs text-muted-foreground/40 italic px-2">
                {t('sessions.empty')}
              </div>
            ) : (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onClick={() => handleSelectSession(session.id)}
                  onDelete={(e) => {
                    e.stopPropagation()
                    handleDeleteSession(session)
                  }}
                />
              ))
            )}
            {hasMoreSessions && (
              <button
                type="button"
                onClick={handleLoadMore}
                className="w-full text-xs text-muted-foreground/50 hover:text-foreground transition-colors py-2 text-center border border-dashed border-border/40 rounded-lg hover:border-border/70"
              >
                {t('sessions.loadMore').replace(
                  '{count}',
                  String(
                    Math.min(
                      INITIAL_SESSION_LIMIT,
                      allSessions.length - visibleCount,
                    ),
                  ),
                )}
              </button>
            )}
          </div>
        </section>

        {/* ── Artifacts ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            <FileCode size={14} />
            <span>{t('artifacts.title')}</span>
          </div>
          <div className="space-y-1">
            {artifacts.length === 0 ? (
              <div className="text-xs text-muted-foreground/40 italic px-2">
                {t('artifacts.empty')}
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
                    {t('artifacts.open')}
                  </span>
                </Button>
              ))
            )}
          </div>
        </section>

        <Modal
          isOpen={!!sessionToDelete}
          onClose={() => setSessionToDelete(null)}
          title={t('delete.title')}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setSessionToDelete(null)}>
                {t('delete.cancel')}
              </Button>
              <Button
                variant="primary"
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-none"
                onClick={confirmDelete}
              >
                {t('delete.confirm')}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {t('delete.body')}
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
