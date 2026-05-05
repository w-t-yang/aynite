/// <reference types="vite/client" />

import type { WorkspacesConfig } from '../../lib/types/workspace';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface ChatSessionEntry {
  id: string;
  date: string;
  lastModified: string;
  size: number;
  preview: string;
}

interface SkillEntry {
  name: string;
  description: string;
  path: string;
  error: string | null;
}

interface CommandEntry {
  name: string;
  description: string;
  parameters: any[];
  example: string;
  path: string;
  error: string | null;
}

interface AiChatPayload {
  messages: any[];
  config: any;
  workspaceFolders: string[];
  activeFile?: string;
}

interface DirectCommandPayload {
  commandPath: string;
  params: string[];
  currentFile?: string;
}

export interface AyniteWindow {
  // Config
  getConfig: (key: string, payload?: any) => Promise<any>
  setConfig: (key: string, payload: any) => Promise<boolean>

  // File operations
  listFolder: (path: string) => Promise<FileEntry[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<boolean>
  createFile: (path: string, isDirectory: boolean) => Promise<boolean>
  renameFile: (oldPath: string, newPath: string) => Promise<boolean>
  copyFile: (srcPath: string, destPath: string) => Promise<boolean>
  deleteFile: (path: string) => Promise<boolean>
  getFileInfo: (path: string) => Promise<{ size: number; createdAt: string; modifiedAt: string; isDirectory: boolean; path: string; extension: string; isText: boolean }>
  getFiles: (path: string) => Promise<FileEntry[]>
  onFileSystemChange: (callback: (data: { event: string; path: string }) => void) => () => void
  move: (oldPath: string, newPath: string) => Promise<boolean>
  remove: (path: string) => Promise<boolean>
  copy: (path: string) => Promise<boolean>
  paste: (destDir: string) => Promise<boolean>

  // Workspace
  getWorkspacesList: () => Promise<WorkspacesConfig>
  createWorkspace: (name: string) => Promise<WorkspacesConfig>
  switchWorkspace: (name: string) => Promise<WorkspacesConfig>
  addWorkspaceFolder: () => Promise<string | null>
  removeWorkspaceFolder: (path: string) => Promise<boolean>
  reorderWorkspaceFolders: (folders: string[]) => Promise<boolean>
  getWorkspaceFolders: () => Promise<string[]>
  workspaceAllFiles: () => Promise<FileEntry[]>

  // AI operations
  aiChat: (payload: AiChatPayload) => Promise<{ requestId?: string; error?: string }>
  getMergedSystemPrompt: {
    (globalFiles?: string[], agentFiles?: string[]): Promise<string>
    (payload: { globalFiles?: string[]; agentFiles?: string[] }): Promise<string>
  }
  listChatLogs: () => Promise<ChatSessionEntry[]>
  saveChatLog: {
    (sessionId: string, messages: any[]): Promise<void>
    (payload: { id: string; messages: any[] }): Promise<void>
  }
  loadChatLog: {
    (sessionId: string, date: string): Promise<any>
    (payload: { id: string; date: string }): Promise<any>
  }
  runDirectCommand: (payload: DirectCommandPayload) => Promise<{ stdout: string; stderr: string }>
  respondToAiApproval: (id: string, approved: boolean) => void
  onAiChatDelta: (requestId: string, callback: (part: any) => void) => () => void
  onAiApprovalRequest: (callback: (data: { id: string; command: string; cwd: string }) => void) => () => void

  // System
  openExternal: (url: string) => Promise<boolean>
  getSystemFonts: () => Promise<string[]>
  selectFolder: () => Promise<string[] | null>

  onAppOperation: (callback: (operation: string) => void) => () => void
  onThemeChanged: (callback: (themeId: string) => void) => () => void

  // Update
  installUpdate: () => Promise<void>
  checkForUpdates: () => void
  onUpdateChecking: (callback: () => void) => () => void
  onUpdateAvailable: (callback: (info: any) => void) => () => void
  onUpdateNotAvailable: (callback: () => void) => () => void
  onUpdateError: (callback: (err: string) => void) => () => void
  onUpdateProgress: (callback: (progress: any) => void) => () => void
  onUpdateDownloaded: (callback: (info: any) => void) => () => void

  // Skills & Commands
  getAvailableSkills: () => Promise<SkillEntry[]>
  getAvailableCommands: () => Promise<CommandEntry[]>
  getAvailableViews: () => Promise<{ id: string; name: string }[]>

  // Utilities
  joinPath: (...paths: string[]) => string
  dirname: (p: string) => string
  platform: string
}

declare global {
  interface Window {
    aynite: AyniteWindow
  }
}
