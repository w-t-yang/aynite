/**
 * Bridge module: Update operations
 *
 * Typed getters and setters for app update management.
 * Setters return Promise<void> — update-* events update UpdateContext state.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ── Getters (return data) ────────────────────────────────────────────

// Update has no getters — all state comes through events.

// ── Setters (return void ── state changes come through events) ───────

export const updateMutations = {
  check: (): Promise<void> => {
    getAynite().checkForUpdates()
    return Promise.resolve()
  },

  download: (): Promise<void> => getAynite().downloadUpdate(),

  install: (): Promise<void> => getAynite().installUpdate(),
}
