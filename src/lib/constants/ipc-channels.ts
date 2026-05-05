/**
 * Unified IPC channel constants shared between Main and Preload/Renderer processes.
 * This file MUST NOT import any Electron or Node.js internal modules to ensure
 * it can be safely imported by the Preload script without pulling in heavy dependencies.
 */

export const ConfigChannels = {
  GET: 'aynite:config-get',
  SET: 'aynite:config-set',
  LOAD: 'aynite:config-load',
  SAVE: 'aynite:config-save',
} as const;

export const ConfigEventChannels = {
  APP_OPERATION: 'aynite:app-operation',
  CONFIG_ERROR: 'aynite:config-error',
  WORKSPACE_CHANGED: 'aynite:workspace-changed',
  THEME_CHANGED: 'aynite:theme-changed',
  VIEW_OPERATION: 'aynite:view-operation',
} as const;


export const FileChannels = {
  LIST: 'aynite:file-list',
  READ: 'aynite:file-read',
  SAVE: 'aynite:file-save',
  CREATE: 'aynite:file-create',
  RENAME: 'aynite:file-rename',
  COPY: 'aynite:file-copy',
  DELETE: 'aynite:file-delete',
  INFO: 'aynite:file-info',
} as const;

export const FileEventChannels = {
  FS_CHANGE: 'aynite:fs-change',
} as const;

export const WorkspaceChannels = {
  LIST: 'aynite:workspace-list',
  CREATE: 'aynite:workspace-create',
  SWITCH: 'aynite:workspace-switch',
  ADD_FOLDER: 'aynite:workspace-add-folder',
  FOLDER_REMOVE: 'aynite:workspace-folder-remove',
  FOLDER_REORDER: 'aynite:workspace-folder-reorder',
  FOLDER_LIST: 'aynite:workspace-folder-list',
  FILE_SCAN: 'aynite:workspace-file-scan',
  STATE_LOAD: 'aynite:workspace-state-load',
  STATE_SAVE: 'aynite:workspace-state-save',
} as const;


export const AiChannels = {
  PROMPT_GET_MERGED: 'aynite:ai-prompt-get-merged',
  GET_TOOLS: 'aynite:ai-get-tools',
  CHAT: 'aynite:ai-chat',
  SESSION_SAVE: 'aynite:ai-session-save',
  SESSION_LOAD: 'aynite:ai-session-load',
  SESSION_LIST: 'aynite:ai-session-list',
  PROMPT_RESTORE: 'aynite:ai-prompt-restore',
  PROMPT_PICK_FILE: 'aynite:ai-prompt-pick-file',
} as const;

export const AiEventChannels = {
  CHAT_DELTA_PREFIX: 'aynite:ai-chat-delta',
  APPROVAL_REQUEST: 'aynite:ai-approval-request',
  APPROVAL_RESPONSE: 'aynite:ai-approval-response',
} as const;

export function aiChatDeltaChannel(requestId: string): string {
  return `${AiEventChannels.CHAT_DELTA_PREFIX}:${requestId}`;
}

export const SpellChannels = {
  SKILL_ADD_FOLDER: 'aynite:spell-skill-add-folder',
  SKILL_RESTORE: 'aynite:spell-skill-restore-default',
  COMMAND_ADD_FOLDER: 'aynite:spell-command-add-folder',
  COMMAND_RESTORE: 'aynite:spell-command-restore-default',
  SKILL_LIST: 'aynite:spell-skill-list',
  COMMAND_LIST: 'aynite:spell-command-list',
  COMMAND_RUN: 'aynite:spell-command-run',
  COMMAND_RUN_DIRECT: 'aynite:spell-command-run-direct',
} as const;


export const SystemChannels = {
  FONT_LIST: 'aynite:system-font-list',
  OPEN_EXTERNAL: 'aynite:system-open-external',
  APP_VERSION: 'aynite:system-app-version',
  APP_QUIT: 'aynite:system-app-quit',
  DIALOG_SELECT_FILE: 'aynite:dialog-select-file',
  DIALOG_SELECT_FOLDER: 'aynite:dialog-select-folder',
  WINDOW_MINIMIZE: 'aynite:window-minimize',
  WINDOW_MAXIMIZE: 'aynite:window-maximize',
  WINDOW_CLOSE: 'aynite:window-close',
  CLIPBOARD_COPY: 'aynite:file-clipboard-copy',
  CLIPBOARD_PASTE: 'aynite:file-clipboard-paste',
  VIEW_LIST: 'aynite:system-view-list',
} as const;


export const UpdateChannels = {
  CHECK: 'aynite:update-check',
  INSTALL: 'aynite:update-install',
  CHECKING: 'aynite:update-checking',
  AVAILABLE: 'aynite:update-available',
  NOT_AVAILABLE: 'aynite:update-not-available',
  ERROR: 'aynite:update-error',
  DOWNLOAD_PROGRESS: 'aynite:update-download-progress',
  DOWNLOADED: 'aynite:update-downloaded',
} as const;


export const ThemeChannels = {
  LIST: 'aynite:theme-list',
  READ: 'aynite:theme-read',
  SAVE: 'aynite:theme-save',
  RESTORE: 'aynite:theme-restore',
  DELETE: 'aynite:theme-delete',
} as const;

