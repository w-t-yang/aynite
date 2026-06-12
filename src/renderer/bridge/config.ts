/**
 * Bridge module: Config
 *
 * Typed getters and setters for config operations.
 * Setters return Promise<void> — state updates come through events.
 */

import type { ConfigSchema } from '../../lib/types/bridge'

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ── Getters (return data) ────────────────────────────────────────────

export const config = (() => ({
  get: <K extends keyof ConfigSchema>(key: K): Promise<ConfigSchema[K]> =>
    getAynite().getConfig(key) as Promise<ConfigSchema[K]>,

  getWithPayload: <T = any>(key: string, payload?: any): Promise<T> =>
    getAynite().getConfig(key, payload),
}))()

// ── Setters (return void — state changes come through events) ────────

export const configMutations = (() => ({
  set: async <K extends keyof ConfigSchema>(
    key: K,
    value: ConfigSchema[K],
  ): Promise<void> => {
    await getAynite().setConfig(key, value)
  },
}))()
