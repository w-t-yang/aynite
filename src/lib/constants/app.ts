export const PROTOCOL = 'aynite'

export const AppOperation = {
  TILE_CYCLE: 'TILE_CYCLE',
  TILE_SPLIT_HORIZONTAL: 'TILE_SPLIT_HORIZONTAL',
  TILE_SPLIT_VERTICAL: 'TILE_SPLIT_VERTICAL',
  TILE_RESIZE_LEFT: 'TILE_RESIZE_LEFT',
  TILE_RESIZE_RIGHT: 'TILE_RESIZE_RIGHT',
  TILE_RESIZE_UP: 'TILE_RESIZE_UP',
  TILE_RESIZE_DOWN: 'TILE_RESIZE_DOWN',
  TILE_CLOSE: 'TILE_CLOSE',

  QUIT: 'QUIT',
  // Global & Navigation
  REFRESH_APP: 'REFRESH_APP',
  TOGGLE_LEFT_PANEL: 'TOGGLE_LEFT_PANEL',
  TOGGLE_RIGHT_PANEL: 'TOGGLE_RIGHT_PANEL',
  FOCUS_CHAT: 'FOCUS_CHAT',
  FOCUS_SKILLS: 'FOCUS_SKILLS',
  FOCUS_COMMANDS: 'FOCUS_COMMANDS',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
  SWITCH_FILE: 'SWITCH_FILE',
} as const

export const AppEvents = {
  // Theme
  THEME_CHANGED: 'theme-changed',

  // Filesystem
  FS_CHANGE: 'fs-change',
  FILE_RENAMED: 'file-renamed',
  FILE_DELETED: 'file-deleted',
  ACTIVE_FILE_CHANGED: 'active-file-changed',

  // App Config/State
  CONFIG_ERROR: 'config-error',
  WORKSPACE_CHANGED: 'workspace-changed',
  WORKSPACE_UPDATED: 'workspace-updated',
  CONFIG_CHANGED: 'config-changed',
  APP_OPERATION: 'app-operation',

  // Updates
  UPDATE_CHECKING: 'update-checking',
  UPDATE_AVAILABLE: 'update-available',
  UPDATE_NOT_AVAILABLE: 'update-not-available',
  UPDATE_ERROR: 'update-error',
  UPDATE_PROGRESS: 'update-download-progress',
  UPDATE_DOWNLOADED: 'update-downloaded',

  // AI
  AI_CHAT_DELTA: 'ai-chat-delta',
  AI_APPROVAL_REQUEST: 'ai-approval-request',

  // Tile
  TILE_ACTIVATED: 'tile-activated',
} as const

export const ViewOperation = {
  BEGINNING_OF_LINE: 'BEGINNING_OF_LINE',
  END_OF_LINE: 'END_OF_LINE',
  KILL_LINE: 'KILL_LINE',
  MARK_WHOLE_BUFFER: 'MARK_WHOLE_BUFFER',
  DELETE_CHAR: 'DELETE_CHAR',
  CUT: 'CUT',
  COPY: 'COPY',
  PASTE: 'PASTE',
  PREVIOUS_LINE: 'PREVIOUS_LINE',
  NEXT_LINE: 'NEXT_LINE',
  FORWARD_CHAR: 'FORWARD_CHAR',
  BACKWARD_CHAR: 'BACKWARD_CHAR',
  KEYBOARD_QUIT: 'KEYBOARD_QUIT',
  REFRESH: 'REFRESH',
} as const
