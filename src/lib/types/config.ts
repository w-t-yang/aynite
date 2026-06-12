/**
 * Config handler types.
 */
export interface ConfigHandler {
  get?: (key: string, payload: any, winId?: number) => Promise<any>
  set?: (key: string, payload: any, winId?: number) => Promise<boolean>
}
