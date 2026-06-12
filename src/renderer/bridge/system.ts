/**
 * Bridge module: System operations
 *
 * Typed wrappers for system-level operations (dialogs, window, fonts, etc.).
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

// ── Getters (return data) ────────────────────────────────────────────

export const system = (() => ({
  getPlatform: (): string => getAynite().platform,

  getSystemFonts: (): Promise<string[]> => getAynite().getSystemFonts(),

  getAvailableViews: (): Promise<{ id: string; name: string }[]> =>
    getAynite().getAvailableViews(),

  selectFolder: (): Promise<string[] | null> => getAynite().selectFolder(),

  selectFile: (options?: any): Promise<string[] | null> =>
    getAynite().selectFile(options),
}))()

// ── Setters (return void) ────────────────────────────────────────────

export const systemMutations = (() => ({
  openExternal: (url: string): Promise<boolean> =>
    getAynite().openExternal(url),

  minimizeWindow: (): Promise<boolean> => getAynite().minimizeWindow(),

  maximizeWindow: (): Promise<boolean> => getAynite().maximizeWindow(),

  closeWindow: (): Promise<boolean> => getAynite().closeWindow(),

  openNewWindow: (): Promise<boolean> => getAynite().openNewWindow(),

  openDevTools: (): Promise<boolean> => getAynite().openDevTools(),

  activateTile: (tileId: string): Promise<boolean> =>
    getAynite().activateTile(tileId),
}))()
