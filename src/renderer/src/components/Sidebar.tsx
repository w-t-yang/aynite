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
  onWorkspaceChange?: () => void;
  onSelectFile?: (file: FileNode, content: string) => void;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ activeTabPath, onWorkspaceChange, onSelectFile, onOpenSettings, onClose }: SidebarProps) {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState('default workspace');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

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
          <FileTreeNode key={file.path} file={file} fetchFiles={fetchFiles} onSelectFile={onSelectFile} level={0} activeTabPath={activeTabPath} />
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
    </div>
  );
}

function FileTreeNode({ 
  file, 
  fetchFiles, 
  onSelectFile, 
  level,
  activeTabPath
}: { 
  file: FileNode, 
  fetchFiles: (val: string) => Promise<FileNode[]>,
  onSelectFile?: (file: FileNode, content: string) => void,
  level: number,
  activeTabPath?: string
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const lastExpandedRef = React.useRef<string | null>(null);

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
        <span className="truncate">{file.name}</span>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
