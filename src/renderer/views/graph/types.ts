interface GraphNode {
  id: string
  label: string
  group?: number
  val?: number // radius/importance
}

export type { GraphNode }

interface GraphLink {
  source: string
  target: string
  value?: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export type { GraphData }
