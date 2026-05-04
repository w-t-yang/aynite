import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, PanelLeftClose, Settings, FolderPlus, Plus } from 'lucide-react';
import { Tree, TreeApi, NodeApi, MoveHandler, NodeRendererProps } from 'react-arborist';
import { cn } from '../../lib/utils';
import { getFileCategory } from '../../lib/file-handlers';
import { Select } from '../../basic/Select';
import { Button } from '../../basic/Button';
import { Input } from '../../basic/Input';
import { KeyManager } from '../../lib/key-handlers';

interface FileNode {
  id: string; // Absolute path
  name: string;
  isDirectory: boolean;
  isLoaded?: boolean;
  children?: FileNode[];
}

interface SidebarProps {
  activeTabPath?: string;
  dirtyFiles?: string[];
  onWorkspaceChange?: () => void;
  onSelectFile?: (file: { name: string; isDirectory: boolean; path: string }) => void;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

export function TreeviewPage({ activeTabPath, dirtyFiles = [], onWorkspaceChange, onSelectFile, onOpenSettings, onClose }: SidebarProps) {
  const [treeData, setTreeData] = useState<FileNode[]>([]);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState('Aynite Playbook');

  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: FileNode } | null>(null);
  
  const [clipboard, setClipboard] = useState<{ paths: string[], action: 'copy' | 'cut' } | null>(null);
  const treeRef = useRef<TreeApi<FileNode> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [treeHeight, setTreeHeight] = useState(800);
  
  const rootFilesPaths = treeData.map((node: string) => node.id);

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
    // @ts-ignore
    const unsubscribe = window.aynite.onFileSystemChange(async ({ event, path }) => {
      // @ts-ignore
      const dirname = await window.aynite.dirname(path);
      window.dispatchEvent(new CustomEvent('reload-folder', { detail: dirname }));
      
      if (event === 'addDir' || event === 'unlinkDir') {
         window.dispatchEvent(new CustomEvent('reload-folder', { detail: path }));
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
      const root = treeData.map((n: string) => n.id).find(r => targetPath.startsWith(r));
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
          const children = await fetchFiles(p);
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
        // Use scrollTo and select with focus:false to highlight without stealing focus
        treeRef.current.scrollTo(targetPath);
        treeRef.current.select(targetPath, { focus: false });
      }, changed ? 100 : 0);
    };

    if (activeTabPath && treeRef.current) {
      expandPathIteratively(activeTabPath);
    }
  }, [activeTabPath, treeData.length]);

  useEffect(() => {
    const handleReload = async (e: unknown) => {
      const folderPath = e.detail;
      const children = await fetchFiles(folderPath);
      setTreeData((prev: FileNode[]) => updateNodeChildren(prev, folderPath, children));
    };
    window.addEventListener('reload-folder', handleReload);
    return () => window.removeEventListener('reload-folder', handleReload);
  }, []);

  const updateNodeChildren = (nodes: FileNode[], targetId: string, children: FileNode[]): FileNode[] => {
    return nodes.map((node: string) => {
      if (node.id === targetId) {
        return { ...node, children, isLoaded: true };
      }
      if (node.children) {
        return { ...node, children: updateNodeChildren(node.children, targetId, children) };
      }
      return node;
    });
  };

  const fetchFiles = async (dirPath: string): Promise<FileNode[]> => {
    try {
      // @ts-ignore
      const res = await window.aynite.getFiles(dirPath);
      return res.map((f: unknown) => ({
        id: f.path,
        name: f.name,
        isDirectory: f.isDirectory,
        isLoaded: !f.isDirectory,
        children: f.isDirectory ? [] : undefined
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const loadWorkspaceData = async () => {
    try {
      // @ts-ignore
      const wsConfig = await window.aynite.getWorkspacesList();
      if (wsConfig) {
        setWorkspaces(wsConfig.list);
        setActiveWorkspace(wsConfig.active);
      }

      // @ts-ignore
      const folders = await window.aynite.getWorkspaceFolders();
      console.log('Sidebar: loaded folders from backend', folders);
      if (folders && Array.isArray(folders)) {
        if (folders.length === 0) {
          console.warn('Sidebar: Workspace has NO folders.');
        }
        const rootNodes = folders.map((f: string) => ({
          id: f,
          name: f.split(/[\/\\]/).pop() || f,
          isDirectory: true,
          isLoaded: false,
          children: []
        }));
        console.log('Sidebar: setting tree data', rootNodes);
        setTreeData(rootNodes);
      } else {
        console.error('Sidebar: failed to load folders', folders);
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
       const children = await fetchFiles(id);
       setTreeData((prev: FileNode[]) => updateNodeChildren(prev, id, children));
    }
  };

  const handleWorkspaceSelect = async (ws: string) => {
    if (ws === '__NEW__') {
      setShowNewWorkspaceModal(true);
      return;
    }
    // @ts-ignore
    await window.aynite.switchWorkspace(ws);
    await loadWorkspaceData();
    onWorkspaceChange?.();
  };

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    if (workspaces.includes(name)) {
      (window as unknown).showToast('Workspace already exists', 'error');
      return;
    }
    // @ts-ignore
    await window.aynite.createWorkspace(name);
    await loadWorkspaceData();
    onWorkspaceChange?.();
    setShowNewWorkspaceModal(false);
    setNewWorkspaceName('');
  };

  const handleAddFolder = async () => {
    // @ts-ignore
    const res = await window.aynite.addWorkspaceFolder();
    if (res) {
      await loadWorkspaceData();
    }
  };

  const onMove: MoveHandler<FileNode> = async ({ dragIds, parentId, index }) => {
    if (parentId === null) {
      const isAllRoots = dragIds.every(id => rootFilesPaths.includes(id));
      if (!isAllRoots) {
        (window as unknown).showToast("Cannot move subfolders to the workspace root.", 'error');
        return;
      }
      const newOrder = rootFilesPaths.filter(id => !dragIds.includes(id));
      newOrder.splice(index, 0, ...dragIds);
      // @ts-ignore
      await window.aynite.reorderWorkspaceFolders(newOrder);
      await loadWorkspaceData();
    } else {
      const hasRoot = dragIds.some(id => rootFilesPaths.includes(id));
      if (hasRoot) {
        (window as unknown).showToast("Cannot move a workspace folder into a subfolder.", 'error');
        return;
      }
      
      const parentNode = treeRef.current?.get(parentId);
      if (!parentNode?.data.isDirectory) return;

      for (const id of dragIds) {
        const name = id.split(/[\/\\]/).pop();
        // @ts-ignore
        const newPath = await window.aynite.joinPath(parentId, name);
        if (id !== newPath) {
          // @ts-ignore
          await window.aynite.renameFile(id, newPath);
          window.dispatchEvent(new CustomEvent('file-renamed', { detail: { oldPath: id, newPath } }));
        }
      }
      window.dispatchEvent(new CustomEvent('reload-folder', { detail: parentId }));
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

    // @ts-ignore
    const dirname = await window.aynite.dirname(file.id);
    const reloadPath = (action === 'new-file' || action === 'new-folder' || action === 'paste') && file.isDirectory ? file.id : dirname;
    const parentDirForPaste = file.isDirectory ? file.id : dirname;

    const executeAction = async (payloadVal?: string) => {
      try {
        if (action === 'paste' && clipboard) {
          for (const src of clipboard.paths) {
            const name = src.split(/[\/\\]/).pop();
            // @ts-ignore
            const dest = await window.aynite.joinPath(parentDirForPaste, name);
            // @ts-ignore
            await window.aynite.copyFile(src, dest);
          }
        } else if ((action === 'new-file' || action === 'new-folder') && payloadVal) {
          // @ts-ignore
          const newPath = await window.aynite.joinPath(file.id, payloadVal);
          // @ts-ignore
          await window.aynite.createFile(newPath, action === 'new-folder');
          if (action === 'new-file' && onSelectFile) {
            onSelectFile({ name: payloadVal, isDirectory: false, path: newPath });
          }
        } else if (action === 'rename' && payloadVal && payloadVal !== file.name) {
          // @ts-ignore
          const newPath = await window.aynite.joinPath(dirname, payloadVal);
          // @ts-ignore
          await window.aynite.renameFile(file.id, newPath);
          window.dispatchEvent(new CustomEvent('file-renamed', { detail: { oldPath: file.id, newPath } }));
        } else if (action === 'delete') {
          // @ts-ignore
          await window.aynite.deleteFile(file.id);
          window.dispatchEvent(new CustomEvent('file-deleted', { detail: file.id }));
        } else if (action === 'remove-from-workspace') {
          // @ts-ignore
          await window.aynite.removeWorkspaceFolder(file.id);
        }
        
        window.dispatchEvent(new CustomEvent('reload-folder', { detail: reloadPath }));
        if (action === 'remove-from-workspace') loadWorkspaceData();
      } catch (e) {
        console.error(e);
        (window as unknown).showToast(String(e), 'error');
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

  useEffect(() => {
    const api = {
      copy: () => {
        const selected = Array.from(treeRef.current?.selectedIds || []);
        if (selected.length > 0) {
          setClipboard({ paths: selected, action: 'copy' });
        }
      },
      paste: () => {
        const selected = Array.from(treeRef.current?.selectedIds || []);
        if (selected.length > 0 && clipboard) {
          const node = treeRef.current?.get(selected[0]);
          if (node) {
            setContextMenu({ x: 0, y: 0, file: node.data });
            setTimeout(() => handleCtxAction('paste'), 0);
          }
        }
      },
      confirm: () => {
        if (showNewWorkspaceModal) {
          handleCreateWorkspace();
        } else if (promptModal?.isOpen && promptValue.trim()) {
          promptModal.onConfirm(promptValue.trim());
        } else if (confirmModal?.isOpen) {
          confirmModal.onConfirm();
        }
      }
    };
    KeyManager.registerSidebar(api);
    return () => KeyManager.unregisterSidebar();
  }, [clipboard, showNewWorkspaceModal, newWorkspaceName, promptModal, promptValue, confirmModal]);

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
        onClick={(e: React.MouseEvent) => {
          node.handleClick(e);
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
            if (isDirectory) {
              node.toggle();
            } else {
               onSelectFile?.({ name, isDirectory, path: id });
            }
          }
        }}
        onContextMenu={(e: React.MouseEvent) => {
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
              <Button variant="ghost" 
                onClick={() => {
                  setShowNewWorkspaceModal(true);
                }}
                className="w-full px-3 py-2 text-[10px] text-left text-primary font-medium hover:bg-accent transition-colors flex items-center gap-2"
              >
                <Plus size={12} /> Create New Workspace...
              </Button>
            }
          />
        </div>
        
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" onClick={handleAddFolder} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"><FolderPlus size={16} /></Button>
          {onClose && <Button variant="ghost" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"><PanelLeftClose size={16} /></Button>}
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
            <Button variant="ghost" 
              onClick={handleAddFolder}
              className="mt-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
            >
              Open Folder
            </Button>
          </div>
        )}
      </div>
      
      <div className="mt-auto border-t border-border p-2 shrink-0 bg-sidebar">
        <Button variant="ghost" onClick={onOpenSettings} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
          <Settings size={16} /> Settings
        </Button>
      </div>

      {showNewWorkspaceModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
            <h3 className="text-lg font-medium mb-4 text-foreground">New Workspace</h3>
            <Input 
              autoFocus
              type="text" 
              placeholder="Workspace name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowNewWorkspaceModal(false); setNewWorkspaceName(''); }} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</Button>
              <Button variant="ghost" onClick={handleCreateWorkspace} className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors font-medium">Create</Button>
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
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {contextMenu.file.isDirectory && (
            <>
              <Button variant="ghost" onClick={() => handleCtxAction('new-file')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">New File</Button>
              <Button variant="ghost" onClick={() => handleCtxAction('new-folder')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">New Folder</Button>
              <div className="h-px bg-border/50 my-1" />
            </>
          )}
          <Button variant="ghost" onClick={() => handleCtxAction('rename')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">Rename</Button>
          
          <div className="h-px bg-border/50 my-1" />
          <Button variant="ghost" onClick={() => handleCtxAction('copy')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">Copy</Button>
          {clipboard && contextMenu.file.isDirectory && (
             <Button variant="ghost" onClick={() => handleCtxAction('paste')} className="px-3 py-1.5 text-left hover:bg-primary hover:text-primary-foreground transition-colors">Paste</Button>
          )}
          <div className="h-px bg-border/50 my-1" />

          {rootFilesPaths.includes(contextMenu.file.id) ? (
            <Button variant="ghost" onClick={() => handleCtxAction('remove-from-workspace')} className="px-3 py-1.5 text-left text-warning hover:bg-warning hover:text-warning-foreground transition-colors">
              Remove from Workspace
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => handleCtxAction('delete')} className="px-3 py-1.5 text-left text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors">
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function PromptModal({ title, placeholder, value, onChange, onConfirm, onCancel }: { title: string, placeholder: string, value: string, onChange: (v: string) => void, onConfirm: (v: string) => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
        <h3 className="text-lg font-medium mb-4 text-foreground">{title}</h3>
        <Input 
          autoFocus
          type="text" 
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</Button>
          <Button variant="ghost" onClick={() => value.trim() && onConfirm(value.trim())} className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors font-medium">Confirm</Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
        <h3 className="text-lg font-medium mb-4 text-foreground">Confirm Deletion</h3>
        <p className="text-sm text-muted-foreground mb-6 break-words">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} className="px-4 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors">Cancel</Button>
          <Button variant="ghost" onClick={onConfirm} className="px-4 py-2 text-sm bg-destructive text-destructive-foreground hover:opacity-90 rounded-md transition-colors font-medium">Delete</Button>
        </div>
      </div>
    </div>
  );
}
