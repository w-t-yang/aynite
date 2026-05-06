import { Copy, Edit2, FilePlus, FolderPlus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type MoveHandler, Tree, type TreeApi } from 'react-arborist'
import { Button } from '../../shared/basic/Button'
import type { SelectionItem } from '../../shared/basic/SelectionList'
import { SelectionMenu } from '../../shared/featured/SelectionMenu'
import { KeyManager } from '../../shared/lib/key-handlers'
import {
  ConfirmModal,
  type FileNode,
  NodeRenderer,
  PromptModal,
} from './components'
import { expandPathIteratively } from './tree-expand'
import { fetchFiles, findNodeData, updateNodeChildren } from './utils'

export function Treeview() {
  const [activeTabPath, _setActiveTabPath] = useState<string>('')
  const [dirtyFiles, _setDirtyFiles] = useState<string[]>([])
  const onWorkspaceChange = () => {}
  const onSelectFile = (file: {
    name: string
    isDirectory: boolean
    path: string
  }) => console.log('Selecting file:', file.path)
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
    file: FileNode
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
    const unsubscribe = window.aynite.onFileSystemChange(
      async ({ event, path }) => {
        const dirname = await window.aynite.dirname(path)
        window.dispatchEvent(
          new CustomEvent('reload-folder', { detail: dirname }),
        )

        if (event === 'addDir' || event === 'unlinkDir') {
          window.dispatchEvent(
            new CustomEvent('reload-folder', { detail: path }),
          )
        }

        if (workspaces.length > 0) {
          const isRootChange =
            rootFilesPathsRef.current.includes(path) ||
            rootFilesPathsRef.current.includes(dirname)
          if (isRootChange) loadWorkspaceDataRef.current()
        }
      },
    )

    const closeMenu = () => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('contextmenu', closeMenu)
    return () => {
      unsubscribe()
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('contextmenu', closeMenu)
    }
  }, [workspaces])

  useEffect(() => {
    loadWorkspaceData()
  }, [loadWorkspaceData])

  useEffect(() => {
    if (activeTabPath && treeRef.current) {
      expandPathIteratively(activeTabPath, treeData, setTreeData, treeRef)
    }
  }, [activeTabPath, treeData.length, treeData])

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
    const res = await window.aynite.addWorkspaceFolder()
    if (res) {
      await loadWorkspaceData()
    }
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
      className="sidebar-container w-full h-full bg-card flex flex-col shrink-0 overflow-hidden outline-none px-2 py-3"
      tabIndex={-1}
    >
      <div ref={containerRef} className="flex-1 overflow-hidden outline-none">
        {treeData.length > 0 ? (
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
                dirtyFiles={dirtyFiles}
              />
            )}
          </Tree>
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
      </div>

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
