/**
 * Sentinel value returned by dispatchGet when no handler is registered.
 * Distinguishable from a handler that returns null (valid data).
 */
export const HANDLER_NOT_FOUND = Symbol('handler-not-found')

export enum ConfigKey {
  WORKSPACE = 'workspace',
  WORKSPACES = 'workspaces',
  ACTIVE_WORKSPACE = 'activeWorkspace',
  KEYBINDINGS = 'keybindings',
  VIEWS = 'views',
  THEMES = 'themes',
  THEME = 'theme',
  ACTIVE_THEME = 'activeTheme',
  CHAT_LOGS = 'chatLogs',
  MERGED_SYSTEM_PROMPT = 'merged-system-prompt',
  LOAD_CHAT_LOG = 'load-chat-log',
  SAVE_CHAT_LOG = 'save-chat-log',
  AI = 'ai',
  AGENTS = 'agents',
  PROMPTS = 'prompts',
  SKILLS = 'skills',
  COMMANDS = 'commands',
  TOOLS = 'tools',
  THEME_DELETE = 'theme-delete',
  VERSION = 'version',
  ACTIVE_FILE = 'activeFile',
  OPENED_FILES = 'openedFiles',
  ACTIVE_SESSION_ID = 'activeSessionId',
  SESSION_DELETE = 'session-delete',
  TILE_DATA = 'tile-data',
  VIEW_CONFIG = 'view-config',
  MATCHING_VIEWS = 'matching-views',
  PLAYBOOK_PATH = 'playbook-path',
}
