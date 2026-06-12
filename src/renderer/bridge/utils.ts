/**
 * Bridge module: Utility operations
 *
 * Typed wrappers for utility functions exposed by the preload.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

export const utils = (() => ({
  joinPath: (...paths: string[]): string => getAynite().joinPath(...paths),

  dirname: (p: string): string => getAynite().dirname(p),

  writeClipboard: (text: string): Promise<boolean> =>
    getAynite().writeClipboard(text),
}))()

export const platform = (): string => getAynite().platform
