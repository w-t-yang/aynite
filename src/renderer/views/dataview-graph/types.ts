interface DataViewGraphNode {
  id: string
  label: string
  group?: number
  val?: number // radius/importance
}

export type { DataViewGraphNode }

interface DataViewGraphLink {
  source: string
  target: string
  value?: number
}

interface DataViewGraph {
  nodes: DataViewGraphNode[]
  links: DataViewGraphLink[]
}

export type { DataViewGraph }
