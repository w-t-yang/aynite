/**
 * Logger bridge — forwards renderer logs to the main process console.
 *
 * Renderer process console.log goes to the Electron DevTools console,
 * not the terminal. This bridge forwards logs via IPC so they appear
 * in the same terminal as the main process logs.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

export const logger = {
  log: (...args: unknown[]) => {
    getAynite()
      .log('log', ...args)
      .catch(() => {})
  },
  warn: (...args: unknown[]) => {
    getAynite()
      .log('warn', ...args)
      .catch(() => {})
  },
  error: (...args: unknown[]) => {
    getAynite()
      .log('error', ...args)
      .catch(() => {})
  },
}
