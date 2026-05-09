export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
  collapsed?: boolean
  parentId?: string
}

export interface MindMapData {
  root: MindMapNode
}
