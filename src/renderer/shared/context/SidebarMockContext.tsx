import React, { createContext, useContext } from 'react';

export interface FileNode {
  id: string; // Absolute path
  name: string;
  isDirectory: boolean;
  isLoaded?: boolean;
  children?: FileNode[];
}

export interface SidebarApi {
  getWorkspacesList: () => Promise<{ list: string[], active: string }>;
  getWorkspaceFolders: () => Promise<string[]>;
  getFiles: (dirPath: string) => Promise<FileNode[]>;
  createWorkspace: (name: string) => Promise<void>;
  switchWorkspace: (name: string) => Promise<void>;
  addWorkspaceFolder: () => Promise<string | null>;
  removeWorkspaceFolder: (path: string) => Promise<void>;
  reorderWorkspaceFolders: (paths: string[]) => Promise<void>;
  createFile: (path: string, isDirectory: boolean) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  copyFile: (src: string, dest: string) => Promise<void>;
  joinPath: (...parts: string[]) => Promise<string>;
  dirname: (path: string) => Promise<string>;
  onFileSystemChange: (callback: (payload: { event: string, path: string }) => void) => () => void;
}

const SidebarMockContext = createContext<SidebarApi | null>(null);

export const useSidebar = () => {
  const context = useContext(SidebarMockContext);
  if (!context) throw new Error('useSidebar must be used within a SidebarMockProvider');
  return context;
};

export const SidebarMockProvider = ({ children, value }: { children: React.ReactNode, value: SidebarApi }) => {
  return (
    <SidebarMockContext.Provider value={value}>
      {children}
    </SidebarMockContext.Provider>
  );
};
