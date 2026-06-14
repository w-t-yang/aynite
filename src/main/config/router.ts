/**
 * Config Router
 *
 * Maps ConfigKey-based getConfig/setConfig calls from the renderer
 * to the correct backend logic across modules. Uses a handler registry
 * pattern — each domain module registers its own handlers.
 *
 * Each handler receives a `winId` parameter identifying which Electron
 * window made the request. Window-scoped keys (activeFile, activeSessionId,
 * etc.) resolve against the calling window's workspace.
 */
import { ConfigHandlerRegistry, HANDLER_NOT_FOUND } from './handler-registry'
import { aiHandlers } from './handlers/ai-handlers'
import { configFileHandlers } from './handlers/config-file-handlers'
import { staticHandlers } from './handlers/static-handlers'
import { telemetryHandlers } from './handlers/telemetry-handlers'
import { themeHandlers } from './handlers/theme-handlers'
import { workspaceHandlers } from './handlers/workspace-handlers'
import { workspaceStateHandlers } from './handlers/workspace-state-handlers'

// ─── Handler Registry Setup ────────────────────────────────────────────

const registry = new ConfigHandlerRegistry()

// Register all domain handlers with their config keys
registry.register(
  ['workspaces', 'activeWorkspace', 'workspace'],
  workspaceHandlers,
)

registry.register(
  ['themes', 'theme', 'activeTheme', 'theme-delete'],
  themeHandlers,
)

registry.register(
  [
    'chatLogs',
    'load-chat-log',
    'save-chat-log',
    'merged-system-prompt',
    'activeFile',
    'openedFiles',
    'activeSessionId',
    'tile-data',
    'session-delete',
  ],
  workspaceStateHandlers,
)

registry.register(['ai', 'agents', 'prompts'], aiHandlers)

registry.register(
  ['keybindings', 'views', 'prompts', 'skills', 'commands', 'tools'],
  configFileHandlers,
)

registry.register(
  ['version', 'playbook-path', 'view-config', 'matching-views', 'language'],
  staticHandlers,
)

registry.register(['telemetry'], telemetryHandlers)

// ─── Public API ────────────────────────────────────────────────────────

/**
 * getConfig — dispatch to the registered handler for the given key.
 */
export async function routeGetConfig(
  key: string,
  payload?: any,
  winId?: number,
): Promise<any> {
  const result = await registry.dispatchGet(key, payload, winId)
  if (result === HANDLER_NOT_FOUND) {
    console.warn(`[ConfigRouter] Unknown getConfig key: ${key}`)
    return null
  }
  return result
}

/**
 * setConfig — dispatch to the registered handler for the given key.
 */
export async function routeSetConfig(
  key: string,
  payload: any,
  winId?: number,
): Promise<boolean> {
  const result = await registry.dispatchSet(key, payload, winId)
  if (!result) {
    console.warn(`[ConfigRouter] Unknown setConfig key: ${key}`)
  }
  return result
}
