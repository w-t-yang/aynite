import { contextBridge, ipcRenderer } from 'electron';
import { joinPaths, getDirname } from '../lib/path';

const api = {
  getFiles: (path: string) => ipcRenderer.invoke('aynite:files', path),
  runCommand: (command: string, cwd?: string) => ipcRenderer.invoke('aynite:command', { command, cwd }),
  readFile: (path: string) => ipcRenderer.invoke('aynite:read-file', path),
  getFileInfo: (path: string) => ipcRenderer.invoke('aynite:file-info', path),
  loadConfig: () => ipcRenderer.invoke('aynite:load-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('aynite:save-config', config),
  saveSession: (sessionId: string, messages: any[]) => ipcRenderer.invoke('aynite:ai-save-session', { sessionId, messages }),
  loadSession: (sessionId: string, date: string) => ipcRenderer.invoke('aynite:ai-load-session', { sessionId, date }),
  listSessions: () => ipcRenderer.invoke('aynite:ai-session-list'),

  // Workspace API
  getWorkspacesList: () => ipcRenderer.invoke('aynite:workspaces-list'),
  createWorkspace: (name: string) => ipcRenderer.invoke('aynite:workspace-create', name),
  switchWorkspace: (name: string) => ipcRenderer.invoke('aynite:workspace-switch', name),
  addWorkspaceFolder: () => ipcRenderer.invoke('aynite:workspace-add-folder'),
  removeWorkspaceFolder: (path: string) => ipcRenderer.invoke('aynite:workspace-remove-folder', path),
  reorderWorkspaceFolders: (folders: string[]) => ipcRenderer.invoke('aynite:workspace-reorder-folders', folders),
  getWorkspaceFolders: () => ipcRenderer.invoke('aynite:workspace-get-folders'),
  workspaceAllFiles: () => ipcRenderer.invoke('aynite:workspace-all-files'),
  getWorkspaceState: () => ipcRenderer.invoke('aynite:workspace-get-state'),
  saveWorkspaceState: (workspaceName: string, tabs: any[], activeTabId: string) => ipcRenderer.invoke('aynite:workspace-save-state', { workspaceName, tabs, activeTabId }),

  // Skills API
  pickSkillFolder: () => ipcRenderer.invoke('aynite:skill-add-folder'),
  restoreDefaultSkills: () => ipcRenderer.invoke('aynite:skills-restore-default'),
  
  // Commands API
  pickCommandFolder: () => ipcRenderer.invoke('aynite:command-add-folder'),
  restoreDefaultCommands: () => ipcRenderer.invoke('aynite:commands-restore-default'),
  getAvailableSkills: () => ipcRenderer.invoke('aynite:skills-list'),
  getAvailableCommands: () => ipcRenderer.invoke('aynite:commands-list'),
  runDirectCommand: (payload: { commandPath: string, params: string[], currentFile?: string }) => ipcRenderer.invoke('aynite:command-run-direct', payload),
  
  // Prompts API
  pickPromptFile: () => ipcRenderer.invoke("aynite:ai-pick-prompt-file"),
  restoreDefaultPrompts: () => ipcRenderer.invoke("aynite:ai-restore-prompts"),
  getMergedSystemPrompt: (globalFiles?: string[], agentFiles?: string[]) => ipcRenderer.invoke("aynite:ai-get-merged-prompts", globalFiles, agentFiles),
  
  // Theme API
  getThemesList: () => ipcRenderer.invoke('aynite:themes-list'),
  getTheme: (name: string) => ipcRenderer.invoke('aynite:theme-get', name),
  saveTheme: (name: string, data: any) => ipcRenderer.invoke('aynite:theme-save', { name, data }),
  restoreDefaultTheme: (name: string) => ipcRenderer.invoke('aynite:theme-restore-default', name),
  deleteTheme: (name: string) => ipcRenderer.invoke('aynite:theme-delete', name),
  getSystemFonts: () => ipcRenderer.invoke('aynite:system-fonts'),

  // File Ops API
  createFile: (path: string, isDirectory: boolean) => ipcRenderer.invoke('aynite:file-create', { path, isDirectory }),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('aynite:file-rename', { oldPath, newPath }),
  copyFile: (srcPath: string, destPath: string) => ipcRenderer.invoke('aynite:file-copy', { srcPath, destPath }),
  deleteFile: (path: string) => ipcRenderer.invoke('aynite:file-delete', path),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('aynite:file-save', { path, content }),
  openExternal: (url: string) => ipcRenderer.invoke('aynite:open-external', url),
  quitApp: () => ipcRenderer.invoke('aynite:app-quit'),
  getAppVersion: () => ipcRenderer.invoke('aynite:app-version'),
  
  // Util
  joinPath: (...paths: string[]) => joinPaths(...paths),
  dirname: (p: string) => getDirname(p),
  
  // Events
  onFileSystemChange: (callback: (data: { event: string, path: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('aynite:fs-change', listener);
    return () => ipcRenderer.removeListener('aynite:fs-change', listener);
  },
  
  // AI API
  aiChat: (payload: any) => ipcRenderer.invoke('aynite:ai-chat', payload),
  getTools: () => ipcRenderer.invoke('aynite:ai-get-tools'),
  sendAiApprovalResponse: (payload: { id: string, approved: boolean }) => ipcRenderer.send('aynite:ai-approval-response', payload),
  onAiChatDelta: (requestId: string, callback: (part: any) => void) => {
    const channel = `aynite:ai-chat-delta:${requestId}`;
    const listener = (_: any, part: any) => callback(part);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onAiApprovalRequest: (callback: (data: { id: string, command: string, cwd: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('aynite:ai-approval-request', listener);
    return () => ipcRenderer.removeListener('aynite:ai-approval-request', listener);
  },

  // Update API
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateChecking: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update:checking', listener);
    return () => ipcRenderer.removeListener('update:checking', listener);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    const listener = (_: any, info: any) => callback(info);
    ipcRenderer.on('update:available', listener);
    return () => ipcRenderer.removeListener('update:available', listener);
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('update:not-available', listener);
    return () => ipcRenderer.removeListener('update:not-available', listener);
  },
  onUpdateError: (callback: (err: string) => void) => {
    const listener = (_: any, err: string) => callback(err);
    ipcRenderer.on('update:error', listener);
    return () => ipcRenderer.removeListener('update:error', listener);
  },
  onUpdateProgress: (callback: (progress: any) => void) => {
    const listener = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('update:download-progress', listener);
    return () => ipcRenderer.removeListener('update:download-progress', listener);
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const listener = (_: any, info: any) => callback(info);
    ipcRenderer.on('update:downloaded', listener);
    return () => ipcRenderer.removeListener('update:downloaded', listener);
  },
  onConfigError: (callback: (data: { type: 'skill' | 'command', path: string, error: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('aynite:config-error', listener);
    return () => ipcRenderer.removeListener('aynite:config-error', listener);
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
