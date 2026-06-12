/**
 * Platform detection constants.
 *
 * Safe to import from ANY process (main, preload, renderer, tests):
 * - No Electron imports
 * - No Node.js internal module imports (only `process` which is polyfilled
 *   by Vite/Rolldown in the renderer)
 */

/** Internal function to safely get the platform string */
function getPlatform(): string {
  try {
    return typeof process !== 'undefined' ? process.platform : ''
  } catch {
    return ''
  }
}

const _platform: string = getPlatform()
export const IS_WINDOWS: boolean = _platform === 'win32'
export const IS_MAC: boolean = _platform === 'darwin'
export const IS_LINUX: boolean = _platform === 'linux'
