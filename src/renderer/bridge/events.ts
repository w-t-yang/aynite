/**
 * Bridge module: Events
 *
 * Wraps app event and app operation IPC calls.
 * This is the ONLY file that should call window.aynite.onAppEvent/onAppOperation.
 */

function getAynite() {
  if (!window.aynite) {
    throw new Error('Aynite bridge not available (not running in Electron?)')
  }
  return window.aynite
}

export const isAvailable = typeof window !== 'undefined' && !!window.aynite

type AppEventHandler = (event: { type: string; data: unknown }) => void
type AppOperationHandler = (operation: string, data?: unknown) => void

export const events = {
  onAppEvent: (cb: AppEventHandler): (() => void) => getAynite().onAppEvent(cb),

  onAppOperation: (cb: AppOperationHandler): (() => void) =>
    getAynite().onAppOperation(cb),

  execute: (operation: string, data?: unknown): void =>
    getAynite().executeAppOperation(operation, data),
}
