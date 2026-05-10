export interface CanvasElement {
  type: string
  version: number
  id: string
  [key: string]: unknown
}

export interface CanvasData {
  type: 'excalidraw'
  version: number
  elements: CanvasElement[]
  appState?: Record<string, unknown>
}
