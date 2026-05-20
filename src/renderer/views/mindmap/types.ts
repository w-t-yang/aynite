interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
  collapsed?: boolean
  parentId?: string
}

export type { MindMapNode }

interface MindMapData {
  root: MindMapNode
}

export type { MindMapData }
