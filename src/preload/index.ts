import { contextBridge, ipcRenderer } from 'electron';
import { 
  FileChannels, 
  FileEventChannels,
  WorkspaceChannels,
  AiChannels,
  AiEventChannels,
  aiChatDeltaChannel,
  ConfigChannels,
  ConfigEventChannels,
  SpellChannels,
  SystemChannels,
  UpdateChannels
} from '../lib/constants/ipc-channels';


// ─── Unified Aynite Bridge ────────────────────────────────────────────────
const aynite = {
  // ── Config ──────────────────────────────────────────────────────────────
  getConfig: (key: string, payload?: any) =>
    ipcRenderer.invoke(ConfigChannels.GET, { key, payload }),
  setConfig: (key: string, payload: any) =>
    ipcRenderer.invoke(ConfigChannels.SET, { key, payload }),

  // ── File operations ─────────────────────────────────────────────────────
  listFolder: (path: string) =>
    ipcRenderer.invoke(FileChannels.LIST, path),
  readFile: (path: string) =>
    ipcRenderer.invoke(FileChannels.READ, path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke(FileChannels.SAVE, { path, content }),
  createFile: (path: string, isDirectory: boolean) =>
    ipcRenderer.invoke(FileChannels.CREATE, { path, isDirectory }),
  renameFile: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(FileChannels.RENAME, { oldPath, newPath }),
  copyFile: (srcPath: string, destPath: string) =>
    ipcRenderer.invoke(FileChannels.COPY, { srcPath, destPath }),
  deleteFile: (path: string) =>
    ipcRenderer.invoke(FileChannels.DELETE, path),
  getFileInfo: (path: string) =>
    ipcRenderer.invoke(FileChannels.INFO, path),
  getFiles: (path: string) =>
    ipcRenderer.invoke(FileChannels.LIST, path),

  onFileSystemChange: (callback: (data: { event: string; path: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(FileEventChannels.FS_CHANGE, listener);
    return () => ipcRenderer.removeListener(FileEventChannels.FS_CHANGE, listener);
  },

  // ── Workspace operations ────────────────────────────────────────────────
  getWorkspacesList: () =>
    ipcRenderer.invoke(WorkspaceChannels.LIST),
  createWorkspace: (name: string) =>
    ipcRenderer.invoke(WorkspaceChannels.CREATE, name),
  switchWorkspace: (name: string) =>
    ipcRenderer.invoke(WorkspaceChannels.SWITCH, name),
  addWorkspaceFolder: () =>
    ipcRenderer.invoke(WorkspaceChannels.ADD_FOLDER),
  removeWorkspaceFolder: (path: string) =>
    ipcRenderer.invoke(WorkspaceChannels.FOLDER_REMOVE, path),
  reorderWorkspaceFolders: (folders: string[]) =>
    ipcRenderer.invoke(WorkspaceChannels.FOLDER_REORDER, folders),
  getWorkspaceFolders: () =>
    ipcRenderer.invoke(WorkspaceChannels.FOLDER_LIST),
  workspaceAllFiles: () =>
    ipcRenderer.invoke(WorkspaceChannels.FILE_SCAN),

  // ── AI operations ───────────────────────────────────────────────────────
  aiChat: (payload: any) =>
    ipcRenderer.invoke(AiChannels.CHAT, payload),
  getMergedSystemPrompt: (arg1?: string[] | { globalFiles?: string[]; agentFiles?: string[] }, agentFiles?: string[]) => {
    if (arg1 && !Array.isArray(arg1) && typeof arg1 === 'object') {
      return ipcRenderer.invoke(AiChannels.PROMPT_GET_MERGED, arg1.globalFiles, arg1.agentFiles);
    }
    return ipcRenderer.invoke(AiChannels.PROMPT_GET_MERGED, arg1 as string[] | undefined, agentFiles);
  },
  listChatLogs: () =>
    ipcRenderer.invoke(AiChannels.SESSION_LIST),
  saveChatLog: (arg1: string | { id: string; messages: any[] }, messages?: any[]) => {
    if (typeof arg1 === 'object') {
      return ipcRenderer.invoke(AiChannels.SESSION_SAVE, { sessionId: arg1.id, messages: arg1.messages });
    }
    return ipcRenderer.invoke(AiChannels.SESSION_SAVE, { sessionId: arg1, messages });
  },
  loadChatLog: (arg1: string | { id: string; date: string }, date?: string) => {
    if (typeof arg1 === 'object') {
      return ipcRenderer.invoke(AiChannels.SESSION_LOAD, { sessionId: arg1.id, date: arg1.date });
    }
    return ipcRenderer.invoke(AiChannels.SESSION_LOAD, { sessionId: arg1, date });
  },
  runDirectCommand: (payload: any) =>
    ipcRenderer.invoke(SpellChannels.COMMAND_RUN_DIRECT, payload),
  respondToAiApproval: (id: string, approved: boolean) =>
    ipcRenderer.send(AiEventChannels.APPROVAL_RESPONSE, { id, approved }),

  onAiChatDelta: (requestId: string, callback: (part: any) => void) => {
    const channel = aiChatDeltaChannel(requestId);
    const listener = (_: any, part: any) => callback(part);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onAiApprovalRequest: (callback: (data: { id: string; command: string; cwd: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on(AiEventChannels.APPROVAL_REQUEST, listener);
    return () => ipcRenderer.removeListener(AiEventChannels.APPROVAL_REQUEST, listener);
  },

  // ── System ──────────────────────────────────────────────────────────────
  openExternal: (url: string) =>
    ipcRenderer.invoke(SystemChannels.OPEN_EXTERNAL, url),
  getSystemFonts: () =>
    ipcRenderer.invoke(SystemChannels.FONT_LIST),
  getAvailableViews: () =>
    ipcRenderer.invoke(SystemChannels.VIEW_LIST),
  checkForUpdates: () =>
    ipcRenderer.invoke(UpdateChannels.CHECK),



  // ── App-level events ────────────────────────────────────────────────────
  onAppOperation: (callback: (operation: string) => void) => {
    const listener = (_: any, operation: string) => callback(operation);
    ipcRenderer.on(ConfigEventChannels.APP_OPERATION, listener);
    return () => ipcRenderer.removeListener(ConfigEventChannels.APP_OPERATION, listener);
  },

  // ── Theme events ────────────────────────────────────────────────────────
  onThemeChanged: (callback: (themeId: string) => void) => {
    const listener = (_: any, themeId: string) => callback(themeId);
    ipcRenderer.on(ConfigEventChannels.THEME_CHANGED, listener);
    return () => ipcRenderer.removeListener(ConfigEventChannels.THEME_CHANGED, listener);
  },

  // ── Update ──────────────────────────────────────────────────────────────
  installUpdate: () =>
    ipcRenderer.invoke(UpdateChannels.INSTALL),
  onUpdateChecking: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(UpdateChannels.CHECKING, listener);
    return () => ipcRenderer.removeListener(UpdateChannels.CHECKING, listener);
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    const listener = (_: any, info: any) => callback(info);
    ipcRenderer.on(UpdateChannels.AVAILABLE, listener);
    return () => ipcRenderer.removeListener(UpdateChannels.AVAILABLE, listener);
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(UpdateChannels.NOT_AVAILABLE, listener);
    return () => ipcRenderer.removeListener(UpdateChannels.NOT_AVAILABLE, listener);
  },
  onUpdateError: (callback: (err: string) => void) => {
    const listener = (_: any, err: string) => callback(err);
    ipcRenderer.on(UpdateChannels.ERROR, listener);
    return () => ipcRenderer.removeListener(UpdateChannels.ERROR, listener);
  },
  onUpdateProgress: (callback: (progress: any) => void) => {
    const listener = (_: any, progress: any) => callback(progress);
    ipcRenderer.on(UpdateChannels.DOWNLOAD_PROGRESS, listener);
    return () => ipcRenderer.removeListener(UpdateChannels.DOWNLOAD_PROGRESS, listener);
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const listener = (_: any, info: any) => callback(info);
    ipcRenderer.on(UpdateChannels.DOWNLOADED, listener);
    return () => ipcRenderer.removeListener(UpdateChannels.DOWNLOADED, listener);
  },

  // ── Utilities ───────────────────────────────────────────────────────────
  joinPath: (...paths: string[]) => paths.join('/'), // Simple browser-safe join fallback or use a lighter helper
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '.',
  platform: process.platform,

  getAvailableSkills: () =>
    ipcRenderer.invoke(SpellChannels.SKILL_LIST),
  getAvailableCommands: () =>
    ipcRenderer.invoke(SpellChannels.COMMAND_LIST),

  // ── Backward compat for view-manager.ts old method names ───────────────
  selectFolder: () =>
    ipcRenderer.invoke(SystemChannels.DIALOG_SELECT_FOLDER),
  move: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(FileChannels.RENAME, { oldPath, newPath }),
  remove: (path: string) =>
    ipcRenderer.invoke(FileChannels.DELETE, path),
  copy: (path: string) =>
    ipcRenderer.invoke(SystemChannels.CLIPBOARD_COPY, path),
  paste: (destDir: string) =>
    ipcRenderer.invoke(SystemChannels.CLIPBOARD_PASTE, destDir),
};

// ─── Expose bridges ─────────────────────────────────────────────────────────
try {
  contextBridge.exposeInMainWorld('aynite', aynite);
} catch (error) {
  console.error(error);
}
