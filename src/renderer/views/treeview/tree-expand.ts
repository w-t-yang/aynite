import type { TreeApi } from 'react-arborist'
import type { FileNode } from './components'
import { fetchFiles, findNodeData, updateNodeChildren } from './utils'

export async function expandPathIteratively(
  targetPath: string,
  treeData: FileNode[],
  setTreeData: (data: FileNode[] | ((prev: FileNode[]) => FileNode[])) => void,
  treeRef: React.MutableRefObject<TreeApi<FileNode> | null>,
): Promise<void> {
  if (!treeData.length) return

  const root = treeData.map((n) => n.id).find((r) => targetPath.startsWith(r))
  if (!root) return

  const separator = targetPath.includes('\\') ? '\\' : '/'
  const rootParts = root.split(separator)
  const activeParts = targetPath.split(separator)

  let current = root
  const pathsToOpen = [current]
  for (let i = rootParts.length; i < activeParts.length - 1; i++) {
    current += separator + activeParts[i]
    pathsToOpen.push(current)
  }

  let newData = [...treeData]
  let changed = false

  for (const p of pathsToOpen) {
    const nodeData = findNodeData(newData, p)
    if (nodeData && !nodeData.isLoaded) {
      const children = await fetchFiles(p)
      newData = updateNodeChildren(newData, p, children)
      changed = true
    }
  }

  if (changed) {
    setTreeData(newData)
  }

  setTimeout(
    () => {
      if (!treeRef.current) return
      for (const p of pathsToOpen) {
        treeRef.current.open(p)
      }
      treeRef.current.scrollTo(targetPath)
      treeRef.current.select(targetPath, { focus: false })
    },
    changed ? 100 : 0,
  )
}
