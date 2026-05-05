/**
 * View Management Protocol
 */

export enum ViewRequest {
  // Navigation & State
  GET_WORKSPACE_STATE = 'get-workspace-state',
  SET_WORKSPACE_STATE = 'set-workspace-state',
  OPEN_FILE = 'open-file',

  // Config
  GET_CONFIG = 'get-config',
  SET_CONFIG = 'set-config',

  // File System
  SELECT_FOLDER = 'select-folder',
  LIST_FOLDER = 'list-folder',
  TREE_DIR = 'tree-dir',
  GET_FILES = 'get-files',
  READ_FILE = 'read-file',
  CREATE = 'create',
  MOVE = 'move',
  REMOVE = 'remove',
  COPY = 'copy',
  PASTE = 'paste',

  // UI Events
  TILE_FOCUS = 'tile-focus',
  KEYBOARD_EVENT = 'keyboard-event',

  // AI & Chat
  AI_CHAT = 'api:ai-chat',
  GET_MERGED_SYSTEM_PROMPT = 'api:get-merged-system-prompt',
  LIST_CHAT_LOGS = 'api:list-chat-logs',
  SAVE_CHAT_LOG = 'api:save-chat-log',
  LOAD_CHAT_LOG = 'api:load-chat-log',
  RUN_DIRECT_COMMAND = 'api:run-direct-command',
  RESPOND_TO_APPROVAL = 'api:respond-to-approval',
}

// Protocol Identifiers
export const AYNITE_VIEW_REQUEST = 'aynite-view-request'
export const AYNITE_VIEW_RESPONSE = 'aynite-view-response'
export const AYNITE_VIEW_OPERATION = 'aynite-view-operation'

// Operation Keys
export const AYNITE_EVENT_ACTIVE_FILE_CHANGED =
  'aynite:event-active-file-changed'
export const AYNITE_EVENT_THEME_CHANGED = 'aynite:event-theme-changed'

/**
 * Data Transfer Objects (DTO)
 */

export interface ViewRequestDTO {
  type: typeof AYNITE_VIEW_REQUEST
  id: string
  method: ViewRequest
  payload?: unknown
}

export interface ViewResponseDTO {
  type: typeof AYNITE_VIEW_RESPONSE
  id: string
  result?: unknown
  error?: string
}

export interface ViewOperationDTO {
  type: typeof AYNITE_VIEW_OPERATION
  operation: string
  params?: unknown
}
