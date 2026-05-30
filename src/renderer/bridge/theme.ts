/**
 * Bridge module: Theme operations
 *
 * Typed getters and setters for theme management.
 * Setters return Promise<void> — theme-changed events update views.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ── Getters (return data) ────────────────────────────────────────────

export const theme = {
  list: (): Promise<string[]> => getAynite().getThemes(),

  get: (name: string): Promise<any> => getAynite().getTheme(name),
}

// ── Setters (return void — state changes come through events) ────────

export const themeMutations = {
  delete: (name: string): Promise<void> =>
    getAynite()
      .deleteTheme(name)
      .then(() => {}),
}

// ── Legacy listener (for backward compat during migration) ───────────

export const themeLegacy = {
  onChanged: (cb: (themeId: string) => void): (() => void) =>
    getAynite().onThemeChanged(cb),
}
