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
  READ_BINARY: 'aynite:file-read-binary',
  OPEN: 'aynite:file-open',
  SAVE: 'aynite:file-save',
  CREATE: 'aynite:file-create',
  RENAME: 'aynite:file-rename',
  COPY: 'aynite:file-copy',
  DELETE: 'aynite:file-delete',
  INFO: 'aynite:file-info',
  CHECK_TEXT: 'aynite:file-check-text',
  WATCH_FILE: 'aynite:file-watch',
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
  WINDOW_DEVTOOLS: 'aynite:window-devtools',
  CLIPBOARD_COPY: 'aynite:file-clipboard-copy',
  CLIPBOARD_PASTE: 'aynite:file-clipboard-paste',
  CLIPBOARD_WRITE_TEXT: 'aynite:clipboard-write-text',
  VIEW_LIST: 'aynite:system-view-list',
  TILE_ACTIVATE: 'aynite:layout-tile-activate',
} as const

export const UpdateChannels = {
  CHECK: 'aynite:update-check',
  DOWNLOAD: 'aynite:update-download',
  INSTALL: 'aynite:update-install',
} as const
export const GitChannels = {
  STATUS: 'aynite:git-status',
  REFRESH_STATUS: 'aynite:git-refresh-status',
  HEAD_CONTENT: 'aynite:git-head-content',
  INDEX_CONTENT: 'aynite:git-index-content',
  STAGE_HUNK: 'aynite:git-stage-hunk',
  DISCARD_HUNK: 'aynite:git-discard-hunk',
  DIFF_STATS: 'aynite:git-diff-stats',
  COMMIT_GENERATE: 'aynite:git-commit-generate',
  COMMIT_EXECUTE: 'aynite:git-commit-execute',
} as const
export const RssChannels = {
  GET_CONFIG: 'aynite:rss-get-config',
  SAVE_CONFIG: 'aynite:rss-save-config',
  FETCH_FEED: 'aynite:rss-fetch-feed',
  FETCH_ALL: 'aynite:rss-fetch-all',
  GET_CONTENT: 'aynite:rss-get-content',
  GET_ALL_CONTENTS: 'aynite:rss-get-all-contents',
  GET_BOOKMARKS: 'aynite:rss-get-bookmarks',
  TOGGLE_BOOKMARK: 'aynite:rss-toggle-bookmark',
  MARK_READ: 'aynite:rss-mark-read',
  MARK_ALL_READ: 'aynite:rss-mark-all-read',
  DELETE_SOURCE_CONTENT: 'aynite:rss-delete-source-content',
  SUMMARIZE: 'aynite:rss-summarize',
} as const

export const SpotifyChannels = {
  INIT_AUTH: 'aynite:spotify-init-auth',
  CHECK_AUTH: 'aynite:spotify-check-auth',
  CHECK_PROTOCOL: 'aynite:spotify-check-protocol',
  LOGOUT: 'aynite:spotify-logout',
  GET_CLIENT_ID: 'aynite:spotify-get-client-id',
  LOAD_ALL: 'aynite:spotify-load-all',
  FETCH_ALL: 'aynite:spotify-fetch-all',
  GET_PLAYBACK_STATE: 'aynite:spotify-get-playback-state',
  PLAY: 'aynite:spotify-play',
  PAUSE: 'aynite:spotify-pause',
  NEXT: 'aynite:spotify-next',
  PREVIOUS: 'aynite:spotify-previous',
  PLAY_TRACK: 'aynite:spotify-play-track',
  PLAY_CONTEXT: 'aynite:spotify-play-context',
  PLAY_TRACK_IN_CONTEXT: 'aynite:spotify-play-track-in-context',
  PLAY_TRACKS: 'aynite:spotify-play-tracks',
  GET_PLAYLIST_TRACKS: 'aynite:spotify-get-playlist-tracks',
  LOAD_PLAYLIST_TRACKS: 'aynite:spotify-load-playlist-tracks',
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
