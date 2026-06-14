export const PROTOCOL = 'aynite'

// OAuth callback URLs
export const SPOTIFY_AUTH_CALLBACK = `${PROTOCOL}://auth/spotify/callback`
export const SPOTIFY_AUTH_CALLBACK_HTTP = 'http://127.0.0.1:18080/callback'

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
  REFRESH_TILE: 'REFRESH_TILE',
  TOGGLE_LEFT_PANEL: 'TOGGLE_LEFT_PANEL',
  TOGGLE_RIGHT_PANEL: 'TOGGLE_RIGHT_PANEL',
  FOCUS_CHAT: 'FOCUS_CHAT',
  FOCUS_SKILLS: 'FOCUS_SKILLS',
  FOCUS_COMMANDS: 'FOCUS_COMMANDS',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
  SWITCH_FILE: 'SWITCH_FILE',
  SETTINGS: 'SETTINGS',
} as const

export const AppEvents = {
  // Theme
  THEME_CHANGED: 'theme-changed',

  // Language / i18n
  LANGUAGE_CHANGED: 'language-changed',

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
  UPDATE_DOWNLOADING: 'update-downloading',
  UPDATE_ERROR: 'update-error',
  UPDATE_PROGRESS: 'update-download-progress',
  UPDATE_DOWNLOADED: 'update-downloaded',

  // AI
  AI_CHAT_DELTA: 'ai-chat-delta',
  AI_APPROVAL_REQUEST: 'ai-approval-request',
  ACTIVE_SESSION_CHANGED: 'active-session-changed',
  SESSION_DELETED: 'session-deleted',
  SESSION_SAVED: 'session-saved',

  // Tile
  TILE_ACTIVATED: 'tile-activated',

  // Git
  GIT_STATUS_CHANGED: 'git-status-changed',

  // Window state
  WINDOW_MAXIMIZED_CHANGED: 'window-maximized-changed',
  FULLSCREEN_CHANGED: 'fullscreen-changed',
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
