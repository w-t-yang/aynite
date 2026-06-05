/**
 * Bridge module: Config
 *
 * Typed getters and setters for config operations.
 * Setters return Promise<void> — state updates come through events.
 */

import type { WorkspacesConfig } from '../../lib/types/workspace'

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ─── Typed Config Keys ────────────────────────────────────────────────
// Maps runtime string keys to TypeScript types for full type safety.

export type ConfigSchema = {
  activeFile: string | null
  activeTheme: string
  activeWorkspace: string
  activeSessionId: string | null
  version: string
  ai: { activeId: string; providers?: any[] }
  agents: { activeId: string; list?: any[] }
  prompts: { files?: string[] }
  tools: { active?: Record<string, boolean> }
  skills: any
  commands: any
  keybindings: any
  themes: any[]
  workspaces: WorkspacesConfig
  workspace: any
  theme: any
  'theme-delete': string
  openedFiles: string[]
  'view-config': any
  'matching-views': any
  chatLogs: any
  'load-chat-log': any
  'save-chat-log': any
  'session-delete': string
  'tile-data': any
  'playbook-path': string
  telemetry: { enabled: boolean; clientId?: string }
}

// ── Getters (return data) ────────────────────────────────────────────

export const config = {
  get: <K extends keyof ConfigSchema>(key: K): Promise<ConfigSchema[K]> =>
    getAynite().getConfig(key) as Promise<ConfigSchema[K]>,

  getWithPayload: <T = any>(key: string, payload?: any): Promise<T> =>
    getAynite().getConfig(key, payload),
}

// ── Setters (return void — state changes come through events) ────────

export const configMutations = {
  set: async <K extends keyof ConfigSchema>(
    key: K,
    value: ConfigSchema[K],
  ): Promise<void> => {
    await getAynite().setConfig(key, value)
  },
}
