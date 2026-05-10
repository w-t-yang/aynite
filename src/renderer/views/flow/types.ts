export interface FlowNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  label?: string
}

export interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}
