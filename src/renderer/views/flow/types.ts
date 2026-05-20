interface FlowNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
}

interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  label?: string
}

interface FlowData {
  nodes: FlowNode[]
  edges: FlowEdge[]
  viewport?: { x: number; y: number; zoom: number }
}

export type { FlowData }
