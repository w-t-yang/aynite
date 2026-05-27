/**
 * Lightweight handler registry for config operations.
 *
 * Domain modules register themselves with their ConfigKey(s), providing
 * optional get and/or set handlers. The router dispatches to these
 * registered handlers instead of using a giant switch statement.
 */

export interface ConfigHandler {
  get?: (key: string, payload: any, winId?: number) => Promise<any>
  set?: (key: string, payload: any, winId?: number) => Promise<boolean>
}

/**
 * Sentinel value returned by dispatchGet when no handler is registered.
 * Distinguishable from a handler that returns null (valid data).
 */
export const HANDLER_NOT_FOUND = Symbol('handler-not-found')

export class ConfigHandlerRegistry {
  private handlers = new Map<string, ConfigHandler>()

  /**
   * Register a handler for one or more config keys.
   */
  register(keys: string[], handler: ConfigHandler): void {
    for (const key of keys) {
      this.handlers.set(key, handler)
    }
  }

  /**
   * Dispatch a getConfig request to the registered handler.
   * Returns the handler's result, or HANDLER_NOT_FOUND if no handler is registered.
   */
  async dispatchGet(key: string, payload?: any, winId?: number): Promise<any> {
    const handler = this.handlers.get(key)
    if (!handler?.get) return HANDLER_NOT_FOUND
    return handler.get(key, payload, winId)
  }

  /**
   * Dispatch a setConfig request to the registered handler.
   * Returns the handler's result, or false if no handler is registered.
   */
  async dispatchSet(
    key: string,
    payload?: any,
    winId?: number,
  ): Promise<boolean> {
    const handler = this.handlers.get(key)
    if (!handler?.set) return false
    return handler.set(key, payload, winId)
  }
}
