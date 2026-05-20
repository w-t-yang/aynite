import {
  Copy,
  Edit2,
  FilePlus,
  FolderPlus,
  FolderTree,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type MoveHandler, Tree, type TreeApi } from 'react-arborist'
import type { DiffStats } from '../../../lib/types/files'
import { Button } from '../../shared/basic/Button'
import type { SelectionItem } from '../../shared/basic/SelectionList'
import { ViewHeader } from '../../shared/basic/ViewHeader'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { KeyManager } from '../../shared/lib/key-handlers'
import { cn } from '../../shared/lib/utils'
import { useAppEvent } from '../ViewContext'
import {
  ConfirmModal,
  type FileNode,
  NodeRenderer,
  PromptModal,
} from './components'
import { useGitStatus } from './hooks/useGitStatus'
import { expandPathIteratively } from './tree-expand'
import { fetchFiles, findNodeData, updateNodeChildren } from './utils'

export function Treeview() {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const lastExpandedPathRef = useRef<string | null>(null)
  const onWorkspaceChange = () => {}
  const onSelectFile = (file: {
    name: string
    isDirectory: boolean
    path: string
  }) => {
    window.aynite.setConfig('activeFile', file.path)
  }
  const _onOpenSettings = () => {}
  const _onClose = () => {}

  const [treeData, setTreeData] = useState<FileNode[]>([])
  const [workspaces, setWorkspaces] = useState<string[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState('Aynite Playbook')

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

  const { gitStatuses, gitRoots, fetchStatus } = useGitStatus()

  const [changesOnly, setChangesOnly] = useState(false)
  const [diffStats, setDiffStats] = useState<Record<string, DiffStats>>({})

  // Fetch git status for workspace folders once they're loaded
  useEffect(() => {
    if (treeData.length > 0) {
      for (const root of treeData) {
        fetchStatus(root.id)
      }
    }
  }, [treeData.length, fetchStatus, treeData])

  // Fetch diff stats when changes-only mode is active or git status updates
  useEffect(() => {
    if (!changesOnly) {
      setDiffStats({})
      return
    }
    // Reference gitStatuses to re-fetch diff stats on status change
    void gitStatuses
    let cancelled = false
    ;(async () => {
      const all: Record<string, DiffStats> = {}
      for (const root of treeData) {
        const stats = await (window as any).aynite.getGitDiffStats(root.id)
        if (!cancelled && stats) Object.assign(all, stats)
      }
      if (!cancelled) setDiffStats(all)
    })()
    return () => {
      cancelled = true
    }
  }, [changesOnly, gitStatuses, treeData])

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
          ? {
              ...prev,
              generating: false,
              message: result.message || '',
            }
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
    for (const node of treeData) {
      fetchStatus(node.id)
    }
  }, [commitState, fetchStatus, treeData])

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

    const addFolderItem: SelectionItem = {
      id: 'add-folder',
      label: 'Add Folder to Workspace...',
      icon: <FolderPlus size={14} />,
    }

    if (!file) return [addFolderItem]

    const items: SelectionItem[] = []

    if (file.isDirectory) {
      items.push({
        id: 'new-file',
        label: 'New File',
        icon: <FilePlus size={14} />,
      })
      items.push({
        id: 'new-folder',
        label: 'New Folder',
        icon: <FolderPlus size={14} />,
      })
    }

    items.push({ id: 'rename', label: 'Rename', icon: <Edit2 size={14} /> })
    items.push({ id: 'copy', label: 'Copy', icon: <Copy size={14} /> })

    if (clipboard && file.isDirectory) {
      items.push({ id: 'paste', label: 'Paste', icon: <Copy size={14} /> })
    }

    if (rootFilesPaths.includes(file.id)) {
      items.push(addFolderItem)
      items.push({
        id: 'remove-from-workspace',
        label: 'Remove from Workspace',
        icon: <X size={14} />,
      })
    } else {
      items.push({
        id: 'delete',
        label: 'Delete',
        icon: <Trash2 size={14} className="text-destructive" />,
        className: 'text-destructive',
      })
    }

    return items
  }, [contextMenu, clipboard, rootFilesPaths])

  const changesTreeData: FileNode[] = useMemo(() => {
    if (!changesOnly) return []

    const changedFiles = new Map<string, DiffStats | null>()
    for (const [path, stats] of Object.entries(diffStats)) {
      changedFiles.set(path, stats)
    }
    for (const [path, status] of Object.entries(gitStatuses)) {
      if (status === 'untracked' && !changedFiles.has(path)) {
        changedFiles.set(path, null)
      }
    }

    return treeData
      .map((root) => {
        const children = Array.from(changedFiles.entries())
          .filter(([path]) => path.startsWith(`${root.id}/`))
          .map(([path]) => ({
            id: path,
            name: path.split('/').pop() || path,
            isDirectory: false,
            isLoaded: true,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        if (children.length === 0) return null
        return {
          id: root.id,
          name: root.name,
          isDirectory: true,
          isLoaded: true,
          children,
        }
      })
      .filter(Boolean) as FileNode[]
  }, [changesOnly, diffStats, gitStatuses, treeData])

  const changesCount = useMemo(() => {
    const paths = Object.entries(gitStatuses)
      .filter(([, status]) => status !== 'none' && status !== 'ignored')
      .map(([path]) => path)
    // Exclude parent directory entries (prefix of another entry)
    return paths.filter(
      (p) => !paths.some((other) => other !== p && other.startsWith(`${p}/`)),
    ).length
  }, [gitStatuses])

  // Auto-expand root folders when entering changes-only mode
  useEffect(() => {
    if (!changesOnly || !treeRef.current || changesTreeData.length === 0) return
    const ids = changesTreeData.map((n) => n.id)
    const timer = setTimeout(() => {
      for (const id of ids) {
        treeRef.current?.open(id)
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [changesOnly, changesTreeData])

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
      const wsConfig = await window.aynite.getWorkspacesList()
      if (wsConfig) {
        setWorkspaces(wsConfig.list)
        setActiveWorkspace(wsConfig.active)
      }

      const folders = await window.aynite.getWorkspaceFolders()
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
  }, [activeFilePath, treeData.length, treeData])

  // Listen for active-file-changed broadcast from main
  useAppEvent('active-file-changed', (data: { path: string }) => {
    if (data?.path) {
      setActiveFilePath(data.path)
    } else {
      setActiveFilePath(null)
    }
  })

  // Initial load of active file
  useEffect(() => {
    window.aynite.getConfig('activeFile').then((path: string) => {
      if (path) {
        setActiveFilePath(path)
      }
    })
  }, [])

  useEffect(() => {
    const handleReload = async (e: any) => {
      const folderPath = e.detail

      const children = await fetchFiles(folderPath)
      setTreeData((prev: FileNode[]) =>
        updateNodeChildren(prev, folderPath, children),
      )
    }
    window.addEventListener('reload-folder', handleReload)
    return () => window.removeEventListener('reload-folder', handleReload)
  }, [])

  const handleToggle = async (id: string) => {
    const node = findNodeData(treeData, id)
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
    await window.aynite.switchWorkspace(ws)
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
    await window.aynite.createWorkspace(name)
    await loadWorkspaceData()
    onWorkspaceChange?.()
    setShowNewWorkspaceModal(false)
    setNewWorkspaceName('')
  }

  const handleAddFolder = async () => {
    try {
      const res = await window.aynite.addWorkspaceFolder()
      if (res) {
        await loadWorkspaceData()
      }
    } catch (e: any) {
      console.error('[Treeview] Failed to add folder:', e)
      const msg = e.message || String(e)
      // Extract the error message from Electron's remote error string if needed
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
      await window.aynite.reorderWorkspaceFolders(newOrder)
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

      const parentNode = treeRef.current?.get(parentId)
      if (!parentNode?.data.isDirectory) return

      for (const id of dragIds) {
        const name = id.split(/[/\\]/).pop()
        if (!name) continue
        const newPath = await window.aynite.joinPath(parentId, name)
        if (id !== newPath) {
          await window.aynite.renameFile(id, newPath)
          window.dispatchEvent(
            new CustomEvent('file-renamed', {
              detail: { oldPath: id, newPath },
            }),
          )
        }
      }
      window.dispatchEvent(
        new CustomEvent('reload-folder', { detail: parentId }),
      )
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
      | 'add-folder',
  ) => {
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

    const dirname = await window.aynite.dirname(file.id)
    const isCreateOrPaste =
      action === 'new-file' || action === 'new-folder' || action === 'paste'
    const shouldReloadHere = file.isDirectory && isCreateOrPaste
    const reloadPath = shouldReloadHere ? file.id : dirname

    const parentDirForPaste = file.isDirectory ? file.id : dirname

    const executeAction = async (payloadVal?: string) => {
      try {
        if (action === 'paste' && clipboard) {
          for (const src of clipboard.paths) {
            const name = src.split(/[/\\]/).pop()
            if (!name) continue
            const dest = await window.aynite.joinPath(parentDirForPaste, name)
            await window.aynite.copyFile(src, dest)
          }
        } else if (
          (action === 'new-file' || action === 'new-folder') &&
          payloadVal
        ) {
          const newPath = await window.aynite.joinPath(file.id, payloadVal)
          await window.aynite.createFile(newPath, action === 'new-folder')
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
          const newPath = await window.aynite.joinPath(dirname, payloadVal)
          await window.aynite.renameFile(file.id, newPath)
          window.dispatchEvent(
            new CustomEvent('file-renamed', {
              detail: { oldPath: file.id, newPath },
            }),
          )
        } else if (action === 'delete') {
          await window.aynite.deleteFile(file.id)
          window.dispatchEvent(
            new CustomEvent('file-deleted', { detail: file.id }),
          )
        } else if (action === 'remove-from-workspace') {
          await window.aynite.removeWorkspaceFolder(file.id)
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
        title: action === 'new-file' ? 'New File' : 'New Folder',
        placeholder: action === 'new-file' ? 'filename.ext' : 'folder_name',
        onConfirm: async (val) => await executeAction(val),
      })
    } else if (action === 'rename') {
      setPromptValue(file.name)
      setPromptModal({
        isOpen: true,
        title: 'Rename',
        placeholder: 'New name',
        onConfirm: async (val) => await executeAction(val),
      })
    } else if (action === 'delete') {
      setConfirmModal({
        isOpen: true,
        message: `Are you sure you want to delete "${file.name}"?`,
        onConfirm: async () => await executeAction(),
      })
    } else if (action === 'remove-from-workspace') {
      setConfirmModal({
        isOpen: true,
        message: `Are you sure you want to remove "${file.name}" from workspace?`,
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
      <ViewHeader icon={<FolderTree size={16} />} title="File Explorer">
        <button
          type="button"
          onClick={() => setChangesOnly(!changesOnly)}
          className={cn(
            'text-[10px] px-2 py-0.5 rounded font-medium transition-colors shrink-0',
            changesOnly
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          Git Diff{changesCount > 0 ? ` (${changesCount})` : ''}
        </button>
      </ViewHeader>
      <section
        ref={containerRef}
        aria-label="File Tree Container"
        className="flex-1 overflow-hidden outline-none"
        onContextMenu={handleContainerContextMenu}
      >
        {treeData.length > 0 ? (
          changesOnly && changesTreeData.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center">
              No changes
            </div>
          ) : changesOnly ? (
            <>
              <Tree
                ref={treeRef}
                data={changesTreeData}
                width="100%"
                height={treeHeight - 68}
                indent={12}
                rowHeight={28}
                openByDefault={false}
                className="scrollbar-gutter-stable"
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
                    diffStats={diffStats}
                    changesOnly={changesOnly}
                  />
                )}
              </Tree>
              <div className="px-3 py-2 border-t border-border/20">
                {changesTreeData.map((root) => {
                  const gitRoot = gitRoots.has(root.id)
                  return gitRoot ? (
                    <button
                      key={root.id}
                      type="button"
                      onClick={() => handleCommit(root.id)}
                      disabled={commitState?.generating}
                      className={cn(
                        'w-full text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                        commitState?.generating
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary/15 text-primary hover:bg-primary/25',
                      )}
                    >
                      {commitState?.generating
                        ? 'Generating message...'
                        : `Commit (${root.name})`}
                    </button>
                  ) : null
                })}
              </div>
            </>
          ) : (
            <Tree
              ref={treeRef}
              data={changesOnly ? changesTreeData : treeData}
              width="100%"
              height={treeHeight - 16}
              indent={12}
              rowHeight={28}
              openByDefault={false}
              onMove={changesOnly ? undefined : onMove}
              onToggle={changesOnly ? undefined : handleToggle}
              className="scrollbar-gutter-stable"
              disableDrop={({ parentNode }) => {
                if (
                  !parentNode ||
                  parentNode.isInternal ||
                  parentNode.level === -1
                )
                  return false
                return !parentNode.data?.isDirectory
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
                  diffStats={diffStats}
                  changesOnly={changesOnly}
                />
              )}
            </Tree>
          )
        ) : (
          <div className="p-4 text-xs text-muted-foreground flex flex-col gap-2">
            <Button
              variant="ghost"
              onClick={handleAddFolder}
              className="mt-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
            >
              Open Folder
            </Button>
          </div>
        )}
      </section>

      {showNewWorkspaceModal && (
        <PromptModal
          title="New Workspace"
          placeholder="Workspace name"
          value={newWorkspaceName}
          onChange={setNewWorkspaceName}
          onConfirm={(v) => handleCreateWorkspace(v)}
          onCancel={() => {
            setShowNewWorkspaceModal(false)
            setNewWorkspaceName('')
          }}
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
        />
      )}

      {commitState && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[520px] bg-card border border-border/40 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/20">
              <h3 className="text-sm font-bold">Commit Changes</h3>
            </div>
            <div className="p-4 space-y-3">
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
            {!commitState.generating && (
              <div className="px-4 py-3 border-t border-border/20 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCommitState(null)}
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
              </div>
            )}
          </div>
        </div>
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
