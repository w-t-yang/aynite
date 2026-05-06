import type { FileNode } from './components'

export const findNodeData = (
  nodes: FileNode[],
  targetId: string,
): FileNode | null => {
  for (const node of nodes) {
    if (node.id === targetId) return node
    if (node.children) {
      const found = findNodeData(node.children, targetId)
      if (found) return found
    }
  }
  return null
}

export const updateNodeChildren = (
  nodes: FileNode[],
  targetId: string,
  children: FileNode[],
): FileNode[] => {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return { ...node, children, isLoaded: true }
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeChildren(node.children, targetId, children),
      }
    }
    return node
  })
}

export const fetchFiles = async (dirPath: string): Promise<FileNode[]> => {
  try {
    const res = await window.aynite.getFiles(dirPath)
    return res.map((f: any) => ({
      id: f.path,
      name: f.name,
      isDirectory: f.isDirectory,
      isLoaded: !f.isDirectory,
      children: f.isDirectory ? [] : undefined,
    }))
  } catch (e) {
    console.error(e)
    return []
  }
}
