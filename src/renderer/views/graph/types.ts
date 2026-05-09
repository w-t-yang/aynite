export interface GraphNode {
  id: string
  label: string
  group?: number
  val?: number // radius/importance
}

export interface GraphLink {
  source: string
  target: string
  value?: number
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}
