import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, PanelLeftClose, Settings, FolderPlus } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface SidebarProps {
  activeTabPath?: string;
  dirtyFiles?: string[];
  onWorkspaceChange?: () => void;
  onSelectFile?: (file: FileNode, content: string) => void;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ activeTabPath, dirtyFiles = [], onWorkspaceChange, onSelectFile, onOpenSettings, onClose }: SidebarProps) {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState('default workspace');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, file: FileNode } | null>(null);
  
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    placeholder: string;
    defaultValue: string;
    onConfirm: (val: string) => Promise<void>;
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    // @ts-ignore
    const unsubscribe = window.api.onFileSystemChange(async ({ event, path }) => {
      // @ts-ignore
      const dirname = await window.api.dirname(path);
      // Reload the parent directory to refresh the tree view
      window.dispatchEvent(new CustomEvent('reload-folder', { detail: dirname }));
      
      // If it's a directory change itself (e.g. its content changed), reload it too
      if (event === 'add' || event === 'unlink' || event === 'addDir' || event === 'unlinkDir') {
         window.dispatchEvent(new CustomEvent('reload-folder', { detail: path }));
      }
      
      // In case a root folder was added/removed externally, reload workspace data
      if (workspaces.length > 0) {
        loadWorkspaceData();
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
  }, [workspaces]);

  const handleCtxAction = async (action: 'new-file' | 'new-folder' | 'rename' | 'delete' | 'remove-from-workspace') => {
    if (!contextMenu) return;
    const { file } = contextMenu;
    setContextMenu(null); // Close menu instantly
    
    // @ts-ignore
    const dirname = await window.api.dirname(file.path);
    const reloadPath = (action === 'new-file' || action === 'new-folder') && file.isDirectory ? file.path : dirname;

    const executeAction = async (payloadVal?: string) => {
      try {
        if ((action === 'new-file' || action === 'new-folder') && payloadVal) {
          // @ts-ignore
          const newPath = await window.api.joinPath(file.path, payloadVal);
          // @ts-ignore
          await window.api.createFile(newPath, action === 'new-folder');
          if (action === 'new-file' && onSelectFile) {
            onSelectFile({ name: payloadVal, isDirectory: false, path: newPath }, '');
          }
        } else if (action === 'rename' && payloadVal && payloadVal !== file.name) {
          // @ts-ignore
          const newPath = await window.api.joinPath(dirname, payloadVal);
          // @ts-ignore
          await window.api.renameFile(file.path, newPath);
          window.dispatchEvent(new CustomEvent('file-renamed', { detail: { oldPath: file.path, newPath } }));
        } else if (action === 'delete') {
          // @ts-ignore
          await window.api.deleteFile(file.path);
          window.dispatchEvent(new CustomEvent('file-deleted', { detail: file.path }));
        } else if (action === 'remove-from-workspace') {
          // @ts-ignore
          await window.api.removeWorkspaceFolder(file.path);
        }
        
        window.dispatchEvent(new CustomEvent('reload-folder', { detail: reloadPath }));
        loadWorkspaceData();
      } catch (e) {
        console.error(e);
        alert(String(e));
      }
    };

    if (action === 'new-file' || action === 'new-folder') {
      setPromptModal({
        isOpen: true,
        title: action === 'new-file' ? 'New File' : 'New Folder',
        placeholder: action === 'new-file' ? 'filename.ext' : 'folder_name',
        defaultValue: '',
        onConfirm: async (val) => await executeAction(val)
      });
    } else if (action === 'rename') {
      setPromptModal({
        isOpen: true,
        title: 'Rename File/Folder',
        placeholder: 'New name',
        defaultValue: file.name,
        onConfirm: async (val) => await executeAction(val)
      });
    } else if (action === 'delete') {
      setConfirmModal({
        isOpen: true,
        message: `Are you sure you want to delete "${file.name}"? This action will permanently delete it from disk.`,
        onConfirm: async () => await executeAction()
      });
    } else if (action === 'remove-from-workspace') {
      setConfirmModal({
        isOpen: true,
        message: `Are you sure you want to remove "${file.name}" from this workspace? The folder will NOT be deleted from disk.`,
        onConfirm: async () => await executeAction()
      });
    }
  };

  const loadWorkspaceData = async () => {
    try {
      // @ts-ignore
      const wsConfig = await window.api.getWorkspacesList();
      if (wsConfig && !wsConfig.error) {
        setWorkspaces(wsConfig.data.list);
        setActiveWorkspace(wsConfig.data.active);
      }

      // @ts-ignore
      const folders = await window.api.getWorkspaceFolders();
      if (folders && Array.isArray(folders.data)) {
        const rootNodes = folders.data.map((f: string) => ({
          name: f.split(/[\/\\]/).pop() || f,
          isDirectory: true,
          path: f
        }));
        setRootFiles(rootNodes);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const fetchFiles = async (dirPath: string) => {
    try {
      // @ts-ignore
      const res = await window.api.getFiles(dirPath);
      if (res.error) throw new Error(res.error);
      return res.data;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const handleWorkspaceSelect = async (ws: string) => {
    setDropdownOpen(false);
    if (ws === '__NEW__') {
      setShowNewWorkspaceModal(true);
      return;
    }
    // @ts-ignore
    await window.api.switchWorkspace(ws);
    await loadWorkspaceData();
    onWorkspaceChange?.();
  };

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    if (workspaces.includes(name)) {
      alert('Workspace already exists');
      return;
    }
    // @ts-ignore
    await window.api.createWorkspace(name);
    await loadWorkspaceData();
    onWorkspaceChange?.();
    setShowNewWorkspaceModal(false);
    setNewWorkspaceName('');
  };

  const handleAddFolder = async () => {
    // @ts-ignore
    const res = await window.api.addWorkspaceFolder();
    if (res && res.data) {
      await loadWorkspaceData();
    }
  };

  return (
    <div className="w-full h-full border-r border-border bg-sidebar flex flex-col shadow-sm shrink-0 overflow-hidden">
      <div className="px-3 py-3 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="relative flex-1 min-w-0 mr-2">
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 w-full text-left text-sm font-semibold tracking-wide text-foreground hover:opacity-80 transition-opacity uppercase truncate cursor-pointer"
          >
            <span className="truncate">{activeWorkspace}</span>
            <ChevronDown size={14} className="shrink-0" />
          </button>
          
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-2 w-48 bg-background border border-border shadow-lg rounded-md z-50 py-1 flex flex-col max-h-60 overflow-y-auto">
                {workspaces.map(ws => (
                  <button 
                    key={ws}
                    onClick={() => handleWorkspaceSelect(ws)}
                    className={cn(
                      "px-3 py-1.5 text-sm text-left truncate hover:bg-accent transition-colors",
                      ws === activeWorkspace && "text-blue-500 font-medium bg-blue-500/10"
                    )}
                  >
                    {ws}
                  </button>
                ))}
                <div className="h-px bg-border my-1 shrink-0" />
                <button 
                  onClick={() => handleWorkspaceSelect('__NEW__')}
                  className="px-3 py-1.5 text-sm text-left text-blue-500 font-medium hover:bg-accent transition-colors shrink-0"
                >
                  Create New Workspace...
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-0.5">
          <button 
            onClick={handleAddFolder}
            title="Add Folder to Workspace"
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <FolderPlus size={16} />
          </button>
          
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-4 pt-2">
        {rootFiles.map(file => (
          <FileTreeNode 
            key={file.path} 
            file={file} 
            fetchFiles={fetchFiles} 
            onSelectFile={onSelectFile} 
            level={0} 
            activeTabPath={activeTabPath} 
            dirtyFiles={dirtyFiles}
            onContextMenu={(e, f) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, file: f });
            }}
          />
        ))}
      </div>
      
      {/* Settings Button at Bottom */}
      <div className="mt-auto border-t border-border p-2 shrink-0 bg-sidebar">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          <Settings size={16} />
          Settings
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
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
              className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => { setShowNewWorkspaceModal(false); setNewWorkspaceName(''); }}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateWorkspace}
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {promptModal?.isOpen && (
        <PromptModal 
           title={promptModal.title}
           placeholder={promptModal.placeholder}
           defaultValue={promptModal.defaultValue}
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
          className="fixed bg-sidebar border border-border shadow-xl rounded-md py-1 z-[100] text-sm text-foreground flex flex-col w-40"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file.isDirectory && (
            <>
              <button onClick={() => { handleCtxAction('new-file'); }} className="px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground">New File</button>
              <button onClick={() => { handleCtxAction('new-folder'); }} className="px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground">New Folder</button>
              <div className="h-px bg-border my-1" />
            </>
          )}
          <button onClick={() => { handleCtxAction('rename'); }} className="px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground">Rename</button>
          
          {rootFiles.some(rf => rf.path === contextMenu.file.path) ? (
            <button 
              onClick={() => { handleCtxAction('remove-from-workspace'); }} 
              className="px-3 py-1.5 text-left hover:bg-accent text-amber-500 hover:bg-amber-500/10 transition-colors"
            >
              Remove from Workspace
            </button>
          ) : (
            <button 
              onClick={() => { handleCtxAction('delete'); }} 
              className="px-3 py-1.5 text-left hover:bg-accent text-red-500 hover:bg-red-500/10 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PromptModal({ title, placeholder, defaultValue, onConfirm, onCancel }: { title: string, placeholder: string, defaultValue: string, onConfirm: (v: string) => void, onCancel: () => void }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
        <h3 className="text-lg font-medium mb-4 text-foreground">{title}</h3>
        <input 
          autoFocus
          type="text" 
          placeholder={placeholder}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && val.trim() && onConfirm(val.trim())}
          className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
          <button onClick={() => val.trim() && onConfirm(val.trim())} className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors font-medium">Confirm</button>
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
          <button onClick={onCancel} className="px-4 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors font-medium">Delete</button>
        </div>
      </div>
    </div>
  );
}

function FileTreeNode({ 
  file, 
  fetchFiles, 
  onSelectFile, 
  level,
  activeTabPath,
  dirtyFiles = [],
  onContextMenu
}: { 
  file: FileNode, 
  fetchFiles: (val: string) => Promise<FileNode[]>,
  onSelectFile?: (file: FileNode, content: string) => void,
  level: number,
  activeTabPath?: string,
  dirtyFiles?: string[],
  onContextMenu?: (e: React.MouseEvent, file: FileNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const lastExpandedRef = React.useRef<string | null>(null);

  useEffect(() => {
    const handleReload = (e: any) => {
      if (e.detail === file.path && file.isDirectory) {
         setLoading(true);
         fetchFiles(file.path).then(childFiles => {
           setChildren(childFiles);
           setLoading(false);
         });
      }
    };
    window.addEventListener('reload-folder', handleReload);
    return () => window.removeEventListener('reload-folder', handleReload);
  }, [file.path, file.isDirectory, fetchFiles]);

  useEffect(() => {
    // Ensure we match the directory structure explicitly to avoid partial string matches
    // e.g. preventing .git matching .gitignore
    const isParentDir = activeTabPath && file.isDirectory && (
      activeTabPath.startsWith(file.path + '/') || 
      activeTabPath.startsWith(file.path + '\\')
    );

    if (isParentDir && lastExpandedRef.current !== activeTabPath) {
      lastExpandedRef.current = activeTabPath;
      if (!expanded && children.length === 0) {
        setLoading(true);
        fetchFiles(file.path).then(childFiles => {
          setChildren(childFiles);
          setLoading(false);
          setExpanded(true);
        });
      } else if (!expanded && children.length > 0) {
        setExpanded(true);
      }
    }
  }, [activeTabPath, file.path, file.isDirectory, expanded, children.length]);

  const toggleExpand = async () => {
    if (!file.isDirectory) {
      // It's a file, fetch its content
      setLoading(true);
      try {
        // @ts-ignore
        const res = await window.api.readFile(file.path);
        if (res.error) throw new Error(res.error);
        const text = res.data;
        onSelectFile?.(file, text);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!expanded && children.length === 0) {
      setLoading(true);
      const childFiles = await fetchFiles(file.path);
      setChildren(childFiles);
      setLoading(false);
    }
    setExpanded(!expanded);
  };

  const paddingLeft = `${(level * 12) + 12}px`;
  const isSelected = activeTabPath && file.path === activeTabPath;

  return (
    <div>
      <div 
        className={cn(
          "flex items-center py-1 cursor-pointer hover:bg-accent text-sm select-none",
          isSelected ? "bg-blue-500/10 text-blue-500 font-medium hover:bg-blue-500/20" : "hover:text-accent-foreground text-muted-foreground"
        )}
        style={{ paddingLeft }}
        onClick={toggleExpand}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu?.(e, file);
        }}
      >
        <span className="w-4 h-4 mr-1 flex items-center justify-center">
          {file.isDirectory ? (
             expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : null}
        </span>
        {file.isDirectory ? (
          expanded ? <FolderOpen size={14} className="mr-1.5 text-blue-400" /> : <Folder size={14} className="mr-1.5 text-blue-400" />
        ) : (
          <File size={14} className="mr-1.5 opacity-70" />
        )}
        <span className={cn("truncate", dirtyFiles.includes(file.path) && "italic font-medium text-blue-400")}>
          {file.name}{dirtyFiles.includes(file.path) && " •"}
        </span>
      </div>
      {expanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <FileTreeNode 
              key={child.path} 
              file={child} 
              fetchFiles={fetchFiles} 
              onSelectFile={onSelectFile}
              level={level + 1} 
              activeTabPath={activeTabPath}
              dirtyFiles={dirtyFiles}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}
