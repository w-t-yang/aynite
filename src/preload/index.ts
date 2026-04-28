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
  removeWorkspaceFolder: (path: string) => ipcRenderer.invoke('api:workspace-remove-folder', path),
  reorderWorkspaceFolders: (folders: string[]) => ipcRenderer.invoke('api:workspace-reorder-folders', folders),
  getWorkspaceFolders: () => ipcRenderer.invoke('api:workspace-get-folders'),
  workspaceAllFiles: () => ipcRenderer.invoke('api:workspace-all-files'),
  getWorkspaceState: () => ipcRenderer.invoke('api:workspace-get-state'),
  saveWorkspaceState: (workspaceName: string, tabs: any[], activeTabId: string) => ipcRenderer.invoke('api:workspace-save-state', { workspaceName, tabs, activeTabId }),

  // Skills API
  pickSkillFolder: () => ipcRenderer.invoke('api:skill-add-folder'),
  restoreDefaultSkills: () => ipcRenderer.invoke('api:skills-restore-default'),
  
  // Commands API
  pickCommandFolder: () => ipcRenderer.invoke('api:command-add-folder'),
  restoreDefaultCommands: () => ipcRenderer.invoke('api:commands-restore-default'),
  getAvailableSkills: () => ipcRenderer.invoke('api:skills-list'),
  getAvailableCommands: () => ipcRenderer.invoke('api:commands-list'),
  runDirectCommand: (payload: { commandPath: string, params: string[], currentFile?: string }) => ipcRenderer.invoke('api:command-run-direct', payload),
  
  // Theme API
  getThemesList: () => ipcRenderer.invoke('api:themes-list'),
  getTheme: (name: string) => ipcRenderer.invoke('api:theme-get', name),
  saveTheme: (name: string, data: any) => ipcRenderer.invoke('api:theme-save', { name, data }),
  restoreDefaultTheme: (name: string) => ipcRenderer.invoke('api:theme-restore-default', name),
  deleteTheme: (name: string) => ipcRenderer.invoke('api:theme-delete', name),
  getSystemFonts: () => ipcRenderer.invoke('api:system-fonts'),

  // File Ops API
  createFile: (path: string, isDirectory: boolean) => ipcRenderer.invoke('api:file-create', { path, isDirectory }),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('api:file-rename', { oldPath, newPath }),
  copyFile: (srcPath: string, destPath: string) => ipcRenderer.invoke('api:file-copy', { srcPath, destPath }),
  deleteFile: (path: string) => ipcRenderer.invoke('api:file-delete', path),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('api:file-save', { path, content }),
  quitApp: () => ipcRenderer.invoke('api:app-quit'),
  
  // Util
  joinPath: (...paths: string[]) => require('path').join(...paths),
  dirname: (p: string) => require('path').dirname(p),
  
  // Events
  onFileSystemChange: (callback: (data: { event: string, path: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('api:fs-change', listener);
    return () => ipcRenderer.removeListener('api:fs-change', listener);
  }
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
