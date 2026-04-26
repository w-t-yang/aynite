import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, PanelLeftClose, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface SidebarProps {
  onSelectFile?: (file: FileNode, content: string) => void;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ onSelectFile, onOpenSettings, onClose }: SidebarProps) {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFiles('.').then(setRootFiles);
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

  return (
    <div className="w-full h-full border-r border-border bg-sidebar flex flex-col shadow-sm shrink-0 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/40 shrink-0">
        <span className="font-semibold text-xs tracking-wider text-foreground opacity-70 uppercase">Explorer</span>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto pb-4 pt-2">
        {rootFiles.map(file => (
          <FileTreeNode key={file.path} file={file} fetchFiles={fetchFiles} onSelectFile={onSelectFile} level={0} />
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
    </div>
  );
}

function FileTreeNode({ 
  file, 
  fetchFiles, 
  onSelectFile, 
  level 
}: { 
  file: FileNode, 
  fetchFiles: (val: string) => Promise<FileNode[]>,
  onSelectFile?: (file: FileNode, content: string) => void,
  level: number 
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div>
      <div 
        className={cn(
          "flex items-center py-1 cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm text-muted-foreground select-none",
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
