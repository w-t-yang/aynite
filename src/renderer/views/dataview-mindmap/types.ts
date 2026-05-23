interface DataViewMindMapNode {
  id: string
  label: string
  children?: DataViewMindMapNode[]
  collapsed?: boolean
  parentId?: string
}

export type { DataViewMindMapNode }

interface DataViewMindMap {
  root: DataViewMindMapNode
}

export type { DataViewMindMap }
