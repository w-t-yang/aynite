export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
  collapsed?: boolean
}

export interface MindMapData {
  root: MindMapNode
}
