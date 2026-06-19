import {
  Copy,
  Edit2,
  FilePlus,
  FolderPlus,
  FolderTree,
  GitBranch,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type MoveHandler, Tree, type TreeApi } from 'react-arborist'
import { config, configMutations } from '../../bridge/config'
import { fileMutations } from '../../bridge/file'
import { utils } from '../../bridge/utils'
import { workspace, workspaceMutations } from '../../bridge/workspace'
import { Button } from '../../shared/basic/Button'
import type { SelectionItem } from '../../shared/basic/SelectionList'
import { ViewHeader } from '../../shared/basic/ViewHeader'
import { GitDiffView } from '../../shared/featured/GitDiffView'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { loadViewTranslations } from '../../shared/i18n/loadViewI18n'
import { useI18n } from '../../shared/i18n/useI18n'
import { KeyManager } from '../../shared/lib/key-handlers'
import { cn, normalizePath } from '../../shared/lib/utils'
import { useViewEvent } from '../useViewEvents'
import { useView } from '../ViewContext'
import {
  ConfirmModal,
  type FileNode,
  NodeRenderer,
  PromptModal,
} from './components'
import viewConfig from './config.json'
import { useGitStatus } from './hooks/useGitStatus'
import { expandPathIteratively } from './tree-expand'
import { fetchFiles, findNodeData, updateNodeChildren } from './utils'

export function Treeview() {
  const { locale } = useView()
  const customTranslations = useMemo(
    () => loadViewTranslations((viewConfig as any).i18n),
    [],
  )
  const { t } = useI18n(locale, customTranslations)

  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const lastExpandedPathRef = useRef<string | null>(null)
  const onWorkspaceChange = () => {}
  const onSelectFile = (file: {
    name: string
    isDirectory: boolean
    path: string
  }) => {
    configMutations.set('activeFile', file.path)
  }
  const _onOpenSettings = () => {}
  const _onClose = () => {}

  const [treeData, setTreeData] = useState<FileNode[]>([])
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState('Aynite')

  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    file: FileNode | null
  } | null>(null)

  const [clipboard, setClipboard] = useState<{
    paths: string[]
    action: 'copy' | 'cut'
  } | null>(null)
  const treeRef = useRef<TreeApi<FileNode> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [treeHeight, setTreeHeight] = useState(800)

  const rootFilesPaths = treeData.map((node) => node.id)
  const rootFilesPathsRef = useRef(rootFilesPaths)
  rootFilesPathsRef.current = rootFilesPaths

  // Find which workspace root folder a path belongs to
  const findRootForPath = useCallback((path: string): string | null => {
    const normalizedPath = normalizePath(path)
    return (
      rootFilesPathsRef.current.find((r) =>
        normalizedPath.startsWith(normalizePath(r)),
      ) || null
    )
  }, [])

  const { gitStatuses, gitRoots, fetchStatus } = useGitStatus()

  const [changesOnly, setChangesOnly] = useState(false)

  // Fetch git status for workspace folders once they're loaded.
  useEffect(() => {
    if (treeData.length > 0) {
      for (const root of treeData) {
        fetchStatus(root.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeData.length, fetchStatus, treeData])

  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean
    title: string
    placeholder: string
    onConfirm: (val: string) => Promise<void>
  } | null>(null)
  const [promptValue, setPromptValue] = useState('')

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    message: string
    onConfirm: () => Promise<void>
  } | null>(null)

  const _workspaceOptions = useMemo(
    (): SelectionItem[] =>
      workspaces.map((ws) => ({
        id: ws,
        label: ws,
        isActive: ws === activeWorkspace,
      })),
    [workspaces, activeWorkspace],
  )

  const contextMenuItems = useMemo((): SelectionItem[] => {
    if (!contextMenu) return []
    const { file } = contextMenu
    const cm = (key: string) => t(`contextMenu.${key}`)

    const addFolderItem: SelectionItem = {
      id: 'add-folder',
      label: cm('addFolder'),
      icon: <FolderPlus size={14} />,
    }

    if (!file) return [addFolderItem]

    const items: SelectionItem[] = []

    if (file.isDirectory) {
      items.push({
        id: 'new-file',
        label: cm('newFile'),
        icon: <FilePlus size={14} />,
      })
      items.push({
        id: 'new-folder',
        label: cm('newFolder'),
        icon: <FolderPlus size={14} />,
      })
      items.push({
        id: 'refresh',
        label: cm('refresh'),
        icon: <RefreshCw size={14} />,
      })
    }

    items.push({ id: 'rename', label: cm('rename'), icon: <Edit2 size={14} /> })
    items.push({ id: 'copy', label: cm('copy'), icon: <Copy size={14} /> })

    if (clipboard && file.isDirectory) {
      items.push({ id: 'paste', label: cm('paste'), icon: <Copy size={14} /> })
    }

    if (rootFilesPaths.includes(file.id)) {
      items.push(addFolderItem)
      items.push({
        id: 'remove-from-workspace',
        label: cm('removeFromWorkspace'),
        icon: <X size={14} />,
      })
    } else {
      items.push({
        id: 'delete',
        label: cm('delete'),
        icon: <Trash2 size={14} className="text-destructive" />,
        className: 'text-destructive',
      })
    }

    return items
  }, [contextMenu, clipboard, rootFilesPaths, t])

  const changesCount = useMemo(() => {
    const paths = Object.entries(gitStatuses)
      .filter(([, status]) => status !== 'none' && status !== 'ignored')
      .map(([path]) => normalizePath(path))
    return paths.filter(
      (p) => !paths.some((other) => other !== p && other.startsWith(`${p}/`)),
    ).length
  }, [gitStatuses])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTreeHeight(entry.contentRect.height)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const loadWorkspaceData = useCallback(async () => {
    try {
      const wsConfig = await workspace.list()
      if (wsConfig) {
        setWorkspaces(wsConfig.list)
        setActiveWorkspace(wsConfig.active)
      }

      const folders = await workspace.folders()
      if (folders && Array.isArray(folders)) {
        const rootNodes = folders.map((f: string) => ({
          id: f,
          name: f.split(/[/\\]/).pop() || f,
          isDirectory: true,
          isLoaded: false,
          children: [],
        }))
        setTreeData(rootNodes)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadWorkspaceDataRef = useRef(loadWorkspaceData)
  loadWorkspaceDataRef.current = loadWorkspaceData

  useEffect(() => {
    loadWorkspaceData()
  }, [loadWorkspaceData])

  useEffect(() => {
    if (activeFilePath && treeRef.current && treeData.length > 0) {
      if (lastExpandedPathRef.current !== activeFilePath) {
        expandPathIteratively(activeFilePath, treeData, setTreeData, treeRef)
        lastExpandedPathRef.current = activeFilePath
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath, treeData.length, treeData])

  const handleActiveFileChanged = useCallback((data: { path: string }) => {
    if (data?.path) {
      setActiveFilePath(data.path)
    } else {
      setActiveFilePath(null)
    }
  }, [])
  useViewEvent('active-file-changed', handleActiveFileChanged)

  useEffect(() => {
    config.get('activeFile').then((path: string | null) => {
      if (path) {
        setActiveFilePath(path)
      }
    })
  }, [])

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingReloadsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const handleReload = async (e: any) => {
      const folderPath = e.detail
      pendingReloadsRef.current.add(folderPath)

      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current)
      }
      reloadTimerRef.current = setTimeout(async () => {
        reloadTimerRef.current = null
        const paths = Array.from(pendingReloadsRef.current)
        pendingReloadsRef.current.clear()

        for (const fp of paths) {
          try {
            const children = await fetchFiles(fp)
            setTreeData((prev: FileNode[]) =>
              updateNodeChildren(prev, fp, children),
            )
          } catch (e) {
            console.error('[Treeview] Failed to reload folder:', e)
          }
        }
      }, 200)
    }
    window.addEventListener('reload-folder', handleReload)
    return () => window.removeEventListener('reload-folder', handleReload)
  }, [])

  const fsChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFsChange = useCallback(
    (data: { event: string; path: string }) => {
      if (data.event === 'change') return

      if (fsChangeTimerRef.current) {
        clearTimeout(fsChangeTimerRef.current)
      }
      fsChangeTimerRef.current = setTimeout(() => {
        fsChangeTimerRef.current = null
        const parentDir = data.path.split('/').slice(0, -1).join('/')
        if (!parentDir) return

        window.dispatchEvent(
          new CustomEvent('reload-folder', { detail: parentDir }),
        )

        const roots = rootFilesPathsRef.current
        const affectedRoot = roots.find((r) =>
          normalizePath(data.path).startsWith(normalizePath(r)),
        )
        if (affectedRoot) {
          fetchStatus(affectedRoot)
        }
      }, 300)
    },
    [fetchStatus],
  )
  useViewEvent('fs-change', handleFsChange)

  const treeDataRef = useRef(treeData)
  treeDataRef.current = treeData

  const handleToggle = async (id: string) => {
    const node = findNodeData(treeDataRef.current, id)
    if (node && !node.isLoaded && node.isDirectory) {
      try {
        const children = await fetchFiles(id)
        setTreeData((prev: FileNode[]) =>
          updateNodeChildren(prev, id, children),
        )
      } catch (e) {
        console.error('Failed to load tree children:', e)
      }
    }
  }

  const _handleWorkspaceSelect = async (ws: string) => {
    if (ws === '__NEW__') {
      setShowNewWorkspaceModal(true)
      return
    }
    await workspaceMutations.switch(ws)
    await loadWorkspaceData()
    onWorkspaceChange?.()
  }

  const handleCreateWorkspace = async (nameOverride?: string) => {
    const name = (nameOverride ?? newWorkspaceName).trim()
    if (!name) return
    if (workspaces.includes(name)) {
      ;(window as any).showToast('Workspace already exists', 'error')
      return
    }
    await workspaceMutations.create(name)
    await loadWorkspaceData()
    onWorkspaceChange?.()
    setShowNewWorkspaceModal(false)
    setNewWorkspaceName('')
  }

  const handleAddFolder = async () => {
    try {
      const res = await workspaceMutations.addFolder()
      if (res) {
        await loadWorkspaceData()
      }
    } catch (e: any) {
      console.error('[Treeview] Failed to add folder:', e)
      const msg = e.message || String(e)
      const cleanMsg = msg.includes('Error: ')
        ? msg.split('Error: ').pop()
        : msg
      ;(window as any).showToast?.(cleanMsg, 'error')
    }
  }

  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, file: null })
  }

  const onMove: MoveHandler<FileNode> = async ({
    dragIds,
    parentId,
    index,
  }) => {
    if (parentId === null) {
      const isAllRoots = dragIds.every((id) => rootFilesPaths.includes(id))
      if (!isAllRoots) {
        ;(window as any).showToast(
          'Cannot move subfolders to the workspace root.',
          'error',
        )
        return
      }
      const newOrder = rootFilesPaths.filter((id) => !dragIds.includes(id))
      newOrder.splice(index, 0, ...dragIds)
      await workspaceMutations.reorderFolders(newOrder)
      await loadWorkspaceData()
    } else {
      const hasRoot = dragIds.some((id) => rootFilesPaths.includes(id))
      if (hasRoot) {
        ;(window as any).showToast(
          'Cannot move a workspace folder into a subfolder.',
          'error',
        )
        return
      }

      const targetRoot = findRootForPath(parentId)
      if (targetRoot) {
        const allSameRoot = dragIds.every(
          (id) => findRootForPath(id) === targetRoot,
        )
        if (!allSameRoot) {
          ;(window as any).showToast(
            'Cannot move files across different workspace folders.',
            'error',
          )
          return
        }
      }

      const parentNode = treeRef.current?.get(parentId)
      if (!parentNode?.data.isDirectory) return

      const sourceDirs = new Set<string>()

      for (const id of dragIds) {
        const name = id.split(/[/\\]/).pop()
        if (!name) continue
        const newPath = utils.joinPath(parentId, name)
        if (id !== newPath) {
          const sourceDir = id.split('/').slice(0, -1).join('/') || '.'
          sourceDirs.add(sourceDir)

          await fileMutations.rename(id, newPath)
          window.dispatchEvent(
            new CustomEvent('file-renamed', {
              detail: { oldPath: id, newPath },
            }),
          )
        }
      }

      const dirsToRefresh = new Set([parentId, ...sourceDirs])
      for (const dir of dirsToRefresh) {
        window.dispatchEvent(new CustomEvent('reload-folder', { detail: dir }))
      }
    }
  }

  const handleCtxAction = async (
    action:
      | 'new-file'
      | 'new-folder'
      | 'rename'
      | 'delete'
      | 'remove-from-workspace'
      | 'copy'
      | 'paste'
      | 'add-folder'
      | 'refresh',
  ) => {
    const promptT = (key: string) => t(`prompt.${key}`)
    const confirmT = (key: string) => t(`confirm.${key}`)

    if (action === 'add-folder') {
      handleAddFolder()
      setContextMenu(null)
      return
    }
    if (!contextMenu?.file) return
    const { file } = contextMenu
    setContextMenu(null)

    if (action === 'copy') {
      const selectedIds = Array.from(
        treeRef.current?.selectedIds || new Set<string>([file.id]),
      )
      setClipboard({ paths: selectedIds, action: 'copy' })
      return
    }

    if (action === 'refresh') {
      const children = await fetchFiles(file.id)
      setTreeData((prev: FileNode[]) =>
        updateNodeChildren(prev, file.id, children),
      )
      fetchStatus(file.id)
      return
    }

    const dirnameVal = utils.dirname(file.id)
    const isCreateOrPaste =
      action === 'new-file' || action === 'new-folder' || action === 'paste'
    const shouldReloadHere = file.isDirectory && isCreateOrPaste
    const reloadPath = shouldReloadHere ? file.id : dirnameVal

    const parentDirForPaste = file.isDirectory ? file.id : dirnameVal

    const executeAction = async (payloadVal?: string) => {
      try {
        if (action === 'paste' && clipboard) {
          for (const src of clipboard.paths) {
            const name = src.split(/[/\\]/).pop()
            if (!name) continue
            const dest = utils.joinPath(parentDirForPaste, name)
            await fileMutations.copy(src, dest)
          }
        } else if (
          (action === 'new-file' || action === 'new-folder') &&
          payloadVal
        ) {
          const newPath = utils.joinPath(file.id, payloadVal)
          await fileMutations.create(newPath, action === 'new-folder')
          if (action === 'new-file' && onSelectFile) {
            onSelectFile({
              name: payloadVal,
              isDirectory: false,
              path: newPath,
            })
          }
        } else if (
          action === 'rename' &&
          payloadVal &&
          payloadVal !== file.name
        ) {
          const newPath = utils.joinPath(dirnameVal, payloadVal)
          await fileMutations.rename(file.id, newPath)
          window.dispatchEvent(
            new CustomEvent('file-renamed', {
              detail: { oldPath: file.id, newPath },
            }),
          )
        } else if (action === 'delete') {
          await fileMutations.delete(file.id)
          window.dispatchEvent(
            new CustomEvent('file-deleted', { detail: file.id }),
          )
        } else if (action === 'remove-from-workspace') {
          await workspaceMutations.removeFolder(file.id)
        }

        window.dispatchEvent(
          new CustomEvent('reload-folder', { detail: reloadPath }),
        )
        if (action === 'remove-from-workspace') loadWorkspaceData()
      } catch (e) {
        console.error(e)
        ;(window as any).showToast(String(e), 'error')
      }
    }

    if (action === 'paste') {
      await executeAction()
    } else if (action === 'new-file' || action === 'new-folder') {
      setPromptValue('')
      setPromptModal({
        isOpen: true,
        title:
          action === 'new-file'
            ? promptT('newFileTitle')
            : promptT('newFolderTitle'),
        placeholder:
          action === 'new-file'
            ? promptT('newFilePlaceholder')
            : promptT('newFolderPlaceholder'),
        onConfirm: async (val) => await executeAction(val),
      })
    } else if (action === 'rename') {
      setPromptValue(file.name)
      setPromptModal({
        isOpen: true,
        title: promptT('renameTitle'),
        placeholder: promptT('renamePlaceholder'),
        onConfirm: async (val) => await executeAction(val),
      })
    } else if (action === 'delete') {
      setConfirmModal({
        isOpen: true,
        message: confirmT('deleteBody').replace('{name}', file.name),
        onConfirm: async () => await executeAction(),
      })
    } else if (action === 'remove-from-workspace') {
      setConfirmModal({
        isOpen: true,
        message: confirmT('removeBody').replace('{name}', file.name),
        onConfirm: async () => await executeAction(),
      })
    }
  }

  const handleCtxActionRef = useRef(handleCtxAction)
  handleCtxActionRef.current = handleCtxAction
  const handleCreateWorkspaceRef = useRef(handleCreateWorkspace)
  handleCreateWorkspaceRef.current = handleCreateWorkspace

  useEffect(() => {
    const api = {
      copy: () => {
        const selected = Array.from(treeRef.current?.selectedIds || [])
        if (selected.length > 0) {
          setClipboard({ paths: selected, action: 'copy' })
        }
      },
      paste: () => {
        const selected = Array.from(treeRef.current?.selectedIds || [])
        if (selected.length > 0 && clipboard) {
          const node = treeRef.current?.get(selected[0])
          if (node) {
            setContextMenu({ x: 0, y: 0, file: node.data })
            setTimeout(() => handleCtxActionRef.current('paste'), 0)
          }
        }
      },
      submit: () => {
        if (showNewWorkspaceModal) {
          handleCreateWorkspaceRef.current()
        } else if (promptModal?.isOpen && promptValue.trim()) {
          promptModal.onConfirm(promptValue.trim())
        } else if (confirmModal?.isOpen) {
          confirmModal.onConfirm()
        }
      },
    }
    KeyManager.registerSidebar(api)
    return () => KeyManager.unregisterSidebar()
  }, [clipboard, showNewWorkspaceModal, promptModal, promptValue, confirmModal])

  return (
    <div
      className="sidebar-container w-full h-full bg-card flex flex-col shrink-0 overflow-hidden outline-none"
      tabIndex={-1}
    >
      <ViewHeader icon={<FolderTree size={16} />} title={t('header')}>
        <button
          type="button"
          onClick={() => setChangesOnly(!changesOnly)}
          title={t('gitDiff')}
          className={cn(
            'p-1 rounded transition-colors shrink-0 relative',
            changesOnly
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          <GitBranch size={14} />
          {changesCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground leading-none">
              {changesCount > 9 ? '9+' : changesCount}
            </span>
          )}
        </button>
      </ViewHeader>
      <section
        ref={containerRef}
        aria-label="File Tree Container"
        className={`flex-1 outline-none ${
          changesOnly ? 'overflow-auto' : 'overflow-hidden'
        }`}
        onContextMenu={handleContainerContextMenu}
      >
        {treeData.length > 0 ? (
          <div className="relative h-full">
            <div className={changesOnly ? 'hidden' : 'h-full'}>
              <Tree
                ref={treeRef}
                data={treeData}
                width="100%"
                height={treeHeight - 16}
                indent={12}
                rowHeight={28}
                openByDefault={false}
                onMove={onMove}
                onToggle={handleToggle}
                className="scrollbar-gutter-stable"
                disableDrop={({ parentNode, dragNodes }) => {
                  if (
                    !parentNode ||
                    parentNode.isInternal ||
                    parentNode.level === -1
                  )
                    return false
                  if (!parentNode.data?.isDirectory) return true

                  const targetRoot = findRootForPath(parentNode.data.id)
                  if (!targetRoot) return false

                  for (const dragNode of dragNodes) {
                    const dragRoot = findRootForPath(dragNode.data.id)
                    if (dragRoot !== targetRoot) return true
                  }

                  return false
                }}
              >
                {(props) => (
                  <NodeRenderer
                    {...props}
                    onSelectFile={onSelectFile}
                    setContextMenu={setContextMenu}
                    dirtyFiles={[]}
                    activeFilePath={activeFilePath}
                    gitStatuses={gitStatuses}
                    gitRoots={gitRoots}
                    diffStats={{}}
                    changesOnly={false}
                  />
                )}
              </Tree>
            </div>
            <div className={changesOnly ? 'h-full' : 'hidden'}>
              <GitDiffView
                folders={treeData.map((n) => n.id)}
                onSelectFile={(path) =>
                  onSelectFile({
                    name: path.split('/').pop() || path,
                    isDirectory: false,
                    path,
                  })
                }
              />
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs text-muted-foreground flex flex-col gap-2">
            <Button
              variant="ghost"
              onClick={handleAddFolder}
              className="mt-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
            >
              {t('openFolder')}
            </Button>
          </div>
        )}
      </section>

      {showNewWorkspaceModal && (
        <PromptModal
          title={t('confirm.newWorkspaceTitle')}
          placeholder={t('confirm.newWorkspacePlaceholder')}
          value={newWorkspaceName}
          onChange={setNewWorkspaceName}
          onConfirm={(v) => handleCreateWorkspace(v)}
          onCancel={() => {
            setShowNewWorkspaceModal(false)
            setNewWorkspaceName('')
          }}
          labels={{ cancel: t('prompt.cancel'), confirm: t('prompt.confirm') }}
        />
      )}

      {promptModal?.isOpen && (
        <PromptModal
          title={promptModal.title}
          placeholder={promptModal.placeholder}
          value={promptValue}
          onChange={setPromptValue}
          onConfirm={async (v) => {
            await promptModal.onConfirm(v)
            setPromptModal(null)
          }}
          onCancel={() => setPromptModal(null)}
          labels={{ cancel: t('prompt.cancel'), confirm: t('prompt.confirm') }}
        />
      )}

      {confirmModal?.isOpen && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={async () => {
            await confirmModal.onConfirm()
            setConfirmModal(null)
          }}
          onCancel={() => setConfirmModal(null)}
          labels={{ cancel: t('confirm.cancel'), delete: t('confirm.delete') }}
        />
      )}

      {contextMenu && (
        <SelectionMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onSelect={(id: string) => handleCtxAction(id as any)}
          onClose={() => setContextMenu(null)}
          divided
        />
      )}
    </div>
  )
}
