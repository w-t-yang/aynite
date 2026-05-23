interface DataViewCanvas {
  type?: string
  version?: number
  elements: unknown[]
  appState?: Record<string, unknown>
}

export type { DataViewCanvas }
