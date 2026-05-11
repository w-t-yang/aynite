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
} as const
export const FileChannels = {
  LIST: 'aynite:file-list',
  READ: 'aynite:file-read',
  OPEN: 'aynite:file-open',
  SAVE: 'aynite:file-save',
  CREATE: 'aynite:file-create',
  RENAME: 'aynite:file-rename',
  COPY: 'aynite:file-copy',
  DELETE: 'aynite:file-delete',
  INFO: 'aynite:file-info',
  CHECK_TEXT: 'aynite:file-check-text',
  WATCHER_REFRESH: 'aynite:file-watcher-refresh',
} as const

export const WorkspaceChannels = {
  LIST: 'aynite:workspace-list',
  CREATE: 'aynite:workspace-create',
  DELETE: 'aynite:workspace-delete',
  SWITCH: 'aynite:workspace-switch',
  ADD_FOLDER: 'aynite:workspace-add-folder',
  FOLDER_REMOVE: 'aynite:workspace-folder-remove',
  FOLDER_REORDER: 'aynite:workspace-folder-reorder',
  FOLDER_LIST: 'aynite:workspace-folder-list',
  FILE_SCAN: 'aynite:workspace-file-scan',
  STATE_LOAD: 'aynite:workspace-state-load',
  STATE_SAVE: 'aynite:workspace-state-save',
} as const

export const AiChannels = {
  PROMPT_GET_MERGED: 'aynite:ai-prompt-get-merged',
  GET_TOOLS: 'aynite:ai-get-tools',
  CHAT: 'aynite:ai-chat',
  SESSION_SAVE: 'aynite:ai-session-save',
  SESSION_LOAD: 'aynite:ai-session-load',
  SESSION_LIST: 'aynite:ai-session-list',
  PROMPT_RESTORE: 'aynite:ai-prompt-restore',
  PROMPT_PICK_FILE: 'aynite:ai-prompt-pick-file',
  ARTIFACTS_STATUS: 'aynite:ai-artifacts-status',
} as const

export const AiEventChannels = {
  APPROVAL_REQUEST: 'aynite:ai-approval-request',
  APPROVAL_RESPONSE: 'aynite:ai-approval-response',
} as const

export const SpellChannels = {
  SKILL_ADD_FOLDER: 'aynite:spell-skill-add-folder',
  SKILL_RESTORE: 'aynite:spell-skill-restore-default',
  COMMAND_ADD_FOLDER: 'aynite:spell-command-add-folder',
  COMMAND_RESTORE: 'aynite:spell-command-restore-default',
  SKILL_LIST: 'aynite:spell-skill-list',
  COMMAND_LIST: 'aynite:spell-command-list',
  COMMAND_RUN: 'aynite:spell-command-run',
  COMMAND_RUN_DIRECT: 'aynite:spell-command-run-direct',
} as const

export const SystemChannels = {
  FONT_LIST: 'aynite:system-font-list',
  OPEN_EXTERNAL: 'aynite:system-open-external',
  APP_VERSION: 'aynite:system-app-version',
  APP_QUIT: 'aynite:system-app-quit',
  DIALOG_SELECT_FILE: 'aynite:dialog-select-file',
  DIALOG_SELECT_FOLDER: 'aynite:dialog-select-folder',
  DIALOG_SAVE_FILE: 'aynite:dialog-save-file',
  WINDOW_MINIMIZE: 'aynite:window-minimize',
  WINDOW_MAXIMIZE: 'aynite:window-maximize',
  WINDOW_CLOSE: 'aynite:window-close',
  WINDOW_NEW: 'aynite:window-new',
  CLIPBOARD_COPY: 'aynite:file-clipboard-copy',
  CLIPBOARD_PASTE: 'aynite:file-clipboard-paste',
  CLIPBOARD_WRITE_TEXT: 'aynite:clipboard-write-text',
  VIEW_LIST: 'aynite:system-view-list',
  TILE_ACTIVATE: 'aynite:layout-tile-activate',
} as const

export const UpdateChannels = {
  CHECK: 'aynite:update-check',
  INSTALL: 'aynite:update-install',
} as const
export const GitChannels = {
  STATUS: 'aynite:git-status',
  HEAD_CONTENT: 'aynite:git-head-content',
} as const
export const ThemeChannels = {
  LIST: 'aynite:theme-list',
  READ: 'aynite:theme-read',
  SAVE: 'aynite:theme-save',
  RESTORE: 'aynite:theme-restore',
  DELETE: 'aynite:theme-delete',
} as const

/**
 * Unified app-level operation execution channel.
 * Renderer sends typed operations here for the main process to execute.
 */
export const AppOperationChannel = 'aynite:app-operation'

/**
 * Unified app-level event broadcast channel.
 * Main process sends typed events here; the main renderer receives them
 * and relays to iframe views via postMessage.
 */
export const AppEventChannel = 'aynite:app-event'
