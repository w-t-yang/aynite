import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, PanelLeftClose, Settings, FolderPlus, Plus } from 'lucide-react';
import { Tree, TreeApi, NodeApi, MoveHandler, NodeRendererProps } from 'react-arborist';
import { cn } from '../../lib/utils';
import { Select } from '../../basic/Select';
import { useSidebar, FileNode } from '../../context/SidebarMockContext';
import { PromptModal } from '../../featured/PromptModal';
import { ConfirmModal } from '../../featured/ConfirmModal';

interface TreeviewPageProps {
  activeTabPath?: string;
  dirtyFiles?: string[];
  onWorkspaceChange?: () => void;
  onSelectFile?: (file: { name: string; isDirectory: boolean; path: string }) => void;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

export function TreeviewPage({ activeTabPath, dirtyFiles = [], onWorkspaceChange, onSelectFile, onOpenSettings, onClose }: TreeviewPageProps) {
  const aynite = useSidebar();
  const [treeData, setTreeData] = useState<FileNode[]>([]);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState('');
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: FileNode } | null>(null);
  
  const [clipboard, setClipboard] = useState<{ paths: string[], action: 'copy' | 'cut' } | null>(null);
  const treeRef = useRef<TreeApi<FileNode> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(800);
  
  const rootFilesPaths = treeData.map(node => node.id);

  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    onConfirm: (val: string) => Promise<void>;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setTreeHeight(entry.contentRect.height);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const unsubscribe = aynite.onFileSystemChange(async ({ event, path }) => {
      const dirname = await aynite.dirname(path);
      handleReloadFolder(dirname);
      
      if (event === 'addDir' || event === 'unlinkDir') {
         handleReloadFolder(path);
      }
      
      if (workspaces.length > 0) {
        const isRootChange = rootFilesPaths.includes(path) || rootFilesPaths.includes(dirname);
        if (isRootChange) loadWorkspaceData();
      }
    });

    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    return () => {
      unsubscribe();
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, [workspaces, treeData]);

  const handleReloadFolder = async (folderPath: string) => {
    const children = await aynite.getFiles(folderPath);
    setTreeData(prev => updateNodeChildren(prev, folderPath, children));
  };

  const findNodeData = (nodes: FileNode[], targetId: string): FileNode | null => {
    for (const node of nodes) {
      if (node.id === targetId) return node;
      if (node.children) {
        const found = findNodeData(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  useEffect(() => {
    const expandPathIteratively = async (targetPath: string) => {
      if (!treeData.length) return;
      const root = treeData.map(n => n.id).find(r => targetPath.startsWith(r));
      if (!root) return;

      const separator = targetPath.includes('\\') ? '\\' : '/';
      const rootParts = root.split(separator);
      const activeParts = targetPath.split(separator);

      let current = root;
      const pathsToOpen = [current];
      for (let i = rootParts.length; i < activeParts.length - 1; i++) {
        current += separator + activeParts[i];
        pathsToOpen.push(current);
      }

      let newData = [...treeData];
      let changed = false;

      for (const p of pathsToOpen) {
        const nodeData = findNodeData(newData, p);
        if (nodeData && !nodeData.isLoaded) {
          const children = await aynite.getFiles(p);
          newData = updateNodeChildren(newData, p, children);
          changed = true;
        }
      }

      if (changed) {
        setTreeData(newData);
      }
      
      setTimeout(() => {
        if (!treeRef.current) return;
        for (const p of pathsToOpen) {
          treeRef.current.open(p);
        }
        treeRef.current.scrollTo(targetPath);
        treeRef.current.select(targetPath, { focus: false });
      }, changed ? 100 : 0);
    };

    if (activeTabPath && treeRef.current) {
      expandPathIteratively(activeTabPath);
    }
  }, [activeTabPath, treeData.length]);

  const updateNodeChildren = (nodes: FileNode[], targetId: string, children: FileNode[]): FileNode[] => {
    return nodes.map(node => {
      if (node.id === targetId) {
        return { ...node, children, isLoaded: true };
      }
      if (node.children) {
        return { ...node, children: updateNodeChildren(node.children, targetId, children) };
      }
      return node;
    });
  };

  const loadWorkspaceData = async () => {
    try {
      const wsConfig = await aynite.getWorkspacesList();
      if (wsConfig) {
        setWorkspaces(wsConfig.list);
        setActiveWorkspace(wsConfig.active);
      }

      const folders = await aynite.getWorkspaceFolders();
      if (folders && Array.isArray(folders)) {
        const rootNodes = folders.map((f: string) => ({
          id: f,
          name: f.split(/[\/\\]/).pop() || f,
          isDirectory: true,
          isLoaded: false,
          children: []
        }));
        setTreeData(rootNodes);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const handleToggle = async (id: string) => {
    const node = treeRef.current?.get(id);
    if (node && node.isOpen && !node.data.isLoaded && node.data.isDirectory) {
       const children = await aynite.getFiles(id);
       setTreeData(prev => updateNodeChildren(prev, id, children));
    }
  };

  const handleWorkspaceSelect = async (ws: string) => {
    if (ws === '__NEW__') {
      setShowNewWorkspaceModal(true);
      return;
    }
    await aynite.switchWorkspace(ws);
    await loadWorkspaceData();
    onWorkspaceChange?.();
  };

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    await aynite.createWorkspace(name);
    await loadWorkspaceData();
    onWorkspaceChange?.();
    setShowNewWorkspaceModal(false);
    setNewWorkspaceName('');
  };

  const handleAddFolder = async () => {
    const res = await aynite.addWorkspaceFolder();
    if (res) {
      await loadWorkspaceData();
    }
  };

  const onMove: MoveHandler<FileNode> = async ({ dragIds, parentId, index }) => {
    if (parentId === null) {
      const isAllRoots = dragIds.every(id => rootFilesPaths.includes(id));
      if (!isAllRoots) return;
      const newOrder = rootFilesPaths.filter(id => !dragIds.includes(id));
      newOrder.splice(index, 0, ...dragIds);
      await aynite.reorderWorkspaceFolders(newOrder);
      await loadWorkspaceData();
    } else {
      const hasRoot = dragIds.some(id => rootFilesPaths.includes(id));
      if (hasRoot) return;
      
      const parentNode = treeRef.current?.get(parentId);
      if (!parentNode?.data.isDirectory) return;

      for (const id of dragIds) {
        const name = id.split(/[\/\\]/).pop();
        const newPath = await aynite.joinPath(parentId, name!);
        if (id !== newPath) {
          await aynite.renameFile(id, newPath);
        }
      }
      handleReloadFolder(parentId);
    }
  };

  const handleCtxAction = async (action: 'new-file' | 'new-folder' | 'rename' | 'delete' | 'remove-from-workspace' | 'copy' | 'paste') => {
    if (!contextMenu) return;
    const { file } = contextMenu;
    setContextMenu(null);

    if (action === 'copy') {
      const selectedIds = Array.from(treeRef.current?.selectedIds || new Set<string>([file.id]));
      setClipboard({ paths: selectedIds, action: 'copy' });
      return;
    }

    const dirname = await aynite.dirname(file.id);
    const reloadPath = (action === 'new-file' || action === 'new-folder' || action === 'paste') && file.isDirectory ? file.id : dirname;
    const parentDirForPaste = file.isDirectory ? file.id : dirname;

    const executeAction = async (payloadVal?: string) => {
      try {
        if (action === 'paste' && clipboard) {
          for (const src of clipboard.paths) {
            const name = src.split(/[\/\\]/).pop();
            const dest = await aynite.joinPath(parentDirForPaste, name!);
            await aynite.copyFile(src, dest);
          }
        } else if ((action === 'new-file' || action === 'new-folder') && payloadVal) {
          const newPath = await aynite.joinPath(file.id, payloadVal);
          await aynite.createFile(newPath, action === 'new-folder');
          if (action === 'new-file' && onSelectFile) {
            onSelectFile({ name: payloadVal, isDirectory: false, path: newPath });
          }
        } else if (action === 'rename' && payloadVal && payloadVal !== file.name) {
          const newPath = await aynite.joinPath(dirname, payloadVal);
          await aynite.renameFile(file.id, newPath);
        } else if (action === 'delete') {
          await aynite.deleteFile(file.id);
        } else if (action === 'remove-from-workspace') {
          await aynite.removeWorkspaceFolder(file.id);
        }
        
        handleReloadFolder(reloadPath);
        if (action === 'remove-from-workspace') loadWorkspaceData();
      } catch (e) {
        console.error(e);
      }
    };

    if (action === 'paste') {
      await executeAction();
    } else if (action === 'new-file' || action === 'new-folder') {
      setPromptValue('');
      setPromptModal({
        isOpen: true,
        title: action === 'new-file' ? 'New File' : 'New Folder',
        placeholder: action === 'new-file' ? 'filename.ext' : 'folder_name',
        onConfirm: async (val) => await executeAction(val)
      });
    } else if (action === 'rename') {
      setPromptValue(file.name);
      setPromptModal({
        isOpen: true,
        title: 'Rename',
        placeholder: 'New name',
        onConfirm: async (val) => await executeAction(val)
      });
    } else if (action === 'delete') {
      setConfirmModal({
        isOpen: true,
        message: `Are you sure you want to delete "${file.name}"?`,
        onConfirm: async () => await executeAction()
      });
    } else if (action === 'remove-from-workspace') {
      setConfirmModal({
        isOpen: true,
        message: `Are you sure you want to remove "${file.name}" from workspace?`,
        onConfirm: async () => await executeAction()
      });
    }
  };

  function NodeRenderer({ node, style, dragHandle }: NodeRendererProps<FileNode>) {
    const { name, isDirectory, id } = node.data;
    const isSelected = node.isSelected;
    const isDirty = dirtyFiles.includes(id);

    return (
      <div 
        style={style} 
        ref={dragHandle} 
        className={cn(
          "flex items-center cursor-pointer hover:bg-accent text-sm select-none",
          isSelected ? "bg-primary/10 text-primary font-medium hover:bg-primary/20" : "text-muted-foreground"
        )}
        onClick={(e) => {
          node.handleClick(e);
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
            if (isDirectory) {
              node.toggle();
            } else {
               onSelectFile?.({ name, isDirectory, path: id });
            }
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          node.select();
          setContextMenu({ x: e.clientX, y: e.clientY, file: node.data });
        }}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center">
          {isDirectory ? (node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        {isDirectory ? (
          node.isOpen ? <FolderOpen size={14} className="mr-1.5 text-primary" /> : <Folder size={14} className="mr-1.5 text-primary" />
        ) : (
          <File size={14} className="mr-1.5 opacity-70" />
        )}
        <span className={cn("truncate", isDirty && "italic font-medium text-primary")}>
          {name}{isDirty && " •"}
        </span>
      </div>
    );
  }

  return (
    <div className="sidebar-container w-full h-full border-r border-border bg-sidebar flex flex-col shadow-sm shrink-0 overflow-hidden outline-none" tabIndex={-1}>
      <div className="px-3 py-3 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="relative flex-1 min-w-0 mr-2">
          <Select
            searchable
            value={activeWorkspace}
            options={workspaces}
            onChange={handleWorkspaceSelect}
            placeholder="Select Workspace"
            searchPlaceholder="Search workspaces..."
            className="w-full"
            footer={
              <button 
                onClick={() => setShowNewWorkspaceModal(true)}
                className="w-full px-3 py-2 text-[10px] text-left text-primary font-medium hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Plus size={12} /> Create New Workspace...
              </button>
            }
          />
        </div>
        
        <div className="flex items-center gap-0.5">
          <button onClick={handleAddFolder} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"><FolderPlus size={16} /></button>
          {onClose && <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"><PanelLeftClose size={16} /></button>}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden outline-none">
        {treeData.length > 0 ? (
          <Tree
            ref={treeRef}
            data={treeData}
            width="100%"
            height={treeHeight}
            indent={12}
            rowHeight={28}
            openByDefault={false}
            onMove={onMove}
            onToggle={handleToggle}
            disableDrop={({ parentNode }) => {
              if (!parentNode || parentNode.isInternal || parentNode.level === -1) return false;
              return !parentNode.data?.isDirectory;
            }}
          >
            {NodeRenderer}
          </Tree>
        ) : (
          <div className="p-4 text-xs text-muted-foreground flex flex-col gap-2">
            <button 
              onClick={handleAddFolder}
              className="mt-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
            >
              Open Folder
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-auto border-t border-border p-2 shrink-0 bg-sidebar">
        <button onClick={onOpenSettings} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
          <Settings size={16} /> Settings
        </button>
      </div>

      {showNewWorkspaceModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
            <h3 className="text-lg font-medium mb-4 text-foreground">New Workspace</h3>
            <input 
              autoFocus
              type="text" 
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowNewWorkspaceModal(false); setNewWorkspaceName(''); }} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
              <button onClick={handleCreateWorkspace} className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors font-medium">Create</button>
            </div>
          </div>
        </div>
      )}

      {promptModal?.isOpen && (
        <PromptModal 
           title={promptModal.title}
           placeholder={promptModal.placeholder}
           value={promptValue}
           onChange={setPromptValue}
           onConfirm={async (v) => { await promptModal.onConfirm(v); setPromptModal(null); }}
           onCancel={() => setPromptModal(null)}
        />
      )}

      {confirmModal?.isOpen && (
        <ConfirmModal 
           message={confirmModal.message}
           onConfirm={async () => { await confirmModal.onConfirm(); setConfirmModal(null); }}
           onCancel={() => setConfirmModal(null)}
        />
      )}

      {contextMenu && (
        <div 
          className="fixed bg-sidebar border border-border shadow-2xl rounded-lg py-1.5 z-[100] text-sm text-foreground flex flex-col w-44 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file.isDirectory && (
            <>
              <button onClick={() => handleCtxAction('new-file')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">New File</button>
              <button onClick={() => handleCtxAction('new-folder')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">New Folder</button>
              <div className="h-px bg-border/50 my-1" />
            </>
          )}
          <button onClick={() => handleCtxAction('rename')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">Rename</button>
          
          <div className="h-px bg-border/50 my-1" />
          <button onClick={() => handleCtxAction('copy')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">Copy</button>
          {clipboard && contextMenu.file.isDirectory && (
             <button onClick={() => handleCtxAction('paste')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">Paste</button>
          )}
          <div className="h-px bg-border/50 my-1" />

          {rootFilesPaths.includes(contextMenu.file.id) ? (
            <button onClick={() => handleCtxAction('remove-from-workspace')} className="px-3 py-1.5 text-left text-orange-500 hover:bg-orange-500 hover:text-white transition-colors">
              Remove from Workspace
            </button>
          ) : (
            <button onClick={() => handleCtxAction('delete')} className="px-3 py-1.5 text-left text-red-500 hover:bg-red-500 hover:text-white transition-colors">
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
