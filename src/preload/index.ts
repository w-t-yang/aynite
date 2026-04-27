import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getFiles: (path: string) => ipcRenderer.invoke('api:files', path),
  runCommand: (command: string, cwd?: string) => ipcRenderer.invoke('api:command', { command, cwd }),
  readFile: (path: string) => ipcRenderer.invoke('api:read-file', path),
  loadConfig: () => ipcRenderer.invoke('api:load-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('api:save-config', config),
  
  // Workspace API
  getWorkspacesList: () => ipcRenderer.invoke('api:workspaces-list'),
  createWorkspace: (name: string) => ipcRenderer.invoke('api:workspace-create', name),
  switchWorkspace: (name: string) => ipcRenderer.invoke('api:workspace-switch', name),
  addWorkspaceFolder: () => ipcRenderer.invoke('api:workspace-add-folder'),
  getWorkspaceFolders: () => ipcRenderer.invoke('api:workspace-get-folders'),
  getWorkspaceState: () => ipcRenderer.invoke('api:workspace-get-state'),
  saveWorkspaceState: (tabs: any[], activeTabId: string) => ipcRenderer.invoke('api:workspace-save-state', { tabs, activeTabId }),
  
  // File Ops API
  createFile: (path: string, isDirectory: boolean) => ipcRenderer.invoke('api:file-create', { path, isDirectory }),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('api:file-rename', { oldPath, newPath }),
  deleteFile: (path: string) => ipcRenderer.invoke('api:file-delete', path),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('api:file-save', { path, content }),
  
  // Util
  joinPath: (...paths: string[]) => require('path').join(...paths),
  dirname: (p: string) => require('path').dirname(p)
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ipcRenderer });
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore
  window.electron = { ipcRenderer };
  // @ts-ignore
  window.api = api;
}
