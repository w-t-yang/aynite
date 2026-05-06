import { AppOperation } from '../../../lib/constants/app'
import type { LayoutNode } from '../../../lib/constants/types'

export const getAllLeafIds = (node: LayoutNode): string[] => {
  if (node.type === 'leaf') return [node.id]
  return node.children.flatMap(getAllLeafIds)
}

function findTileInSplit(
  n: LayoutNode,
  activeTileId: string,
): { targetIndex: number; children: LayoutNode[] } | null {
  if (n.type !== 'split') return null
  const targetIndex = n.children.findIndex(
    (child) =>
      child.id === activeTileId ||
      (child.type === 'split' && getAllLeafIds(child).includes(activeTileId)),
  )
  if (targetIndex === -1) return null
  return { targetIndex, children: n.children }
}

export const splitActiveTile = (
  node: LayoutNode,
  activeTileId: string,
  direction: 'horizontal' | 'vertical',
): LayoutNode => {
  const transform = (n: LayoutNode): LayoutNode => {
    if (n.type === 'split') {
      const found = findTileInSplit(n, activeTileId)
      if (found) {
        const { targetIndex, children } = found
        const updatedChildren = [...children]

        if (
          n.direction === direction &&
          children[targetIndex].id === activeTileId
        ) {
          const newId = `tile-${Math.random().toString(36).substr(2, 9)}`
          const activeChild = n.children[targetIndex]
          const halfSize = activeChild.size / 2

          updatedChildren[targetIndex] = { ...activeChild, size: halfSize }
          updatedChildren.splice(targetIndex + 1, 0, {
            type: 'leaf',
            id: newId,
            content: 'New Tile',
            size: halfSize,
          })
          return { ...n, children: updatedChildren }
        }

        const transformedChild = transform(n.children[targetIndex])
        if (transformedChild !== n.children[targetIndex]) {
          updatedChildren[targetIndex] = transformedChild
          return { ...n, children: updatedChildren }
        }
      }

      return { ...n, children: n.children.map(transform) }
    }

    if (n.type === 'leaf' && n.id === activeTileId) {
      const newId = `tile-${Math.random().toString(36).substr(2, 9)}`
      return {
        type: 'split',
        direction,
        id: `split-${Math.random().toString(36).substr(2, 9)}`,
        size: n.size,
        children: [
          { ...n, size: 50 },
          { type: 'leaf', id: newId, content: 'New Tile', size: 50 },
        ],
      }
    }
    return n
  }
  return transform(node)
}

export const closeActiveTile = (
  node: LayoutNode,
  activeTileId: string,
): LayoutNode | null => {
  const leafIds = getAllLeafIds(node)
  if (leafIds.length <= 1) return node

  const transform = (n: LayoutNode): LayoutNode | null => {
    if (n.type === 'leaf') return n.id === activeTileId ? null : n
    const newChildren = n.children
      .map(transform)
      .filter((c): c is LayoutNode => c !== null)
    if (newChildren.length === 0) return null
    if (newChildren.length === 1) return { ...newChildren[0], size: n.size }
    const currentTotal = newChildren.reduce((sum, c) => sum + c.size, 0)
    return {
      ...n,
      children: newChildren.map((c) => ({
        ...c,
        size: (c.size / currentTotal) * 100,
      })),
    }
  }
  return transform(node)
}

export const resizeActiveTile = (
  node: LayoutNode,
  activeTileId: string,
  dir: 'up' | 'down' | 'left' | 'right',
): LayoutNode => {
  const deltaPx = 20
  const isHorizontal = dir === 'left' || dir === 'right'
  const isNegative = dir === 'left' || dir === 'up'
  const moveAmount = isNegative ? -deltaPx : deltaPx

  const transform = (n: LayoutNode): LayoutNode => {
    if (n.type === 'split') {
      const found = findTileInSplit(n, activeTileId)
      if (found) {
        const { targetIndex, children } = found
        const updatedChildren = [...children]
        let handledDeeply = false

        updatedChildren[targetIndex] = transform(children[targetIndex])
        if (updatedChildren[targetIndex] !== children[targetIndex]) {
          handledDeeply = true
        }

        if (handledDeeply) {
          return { ...n, children: updatedChildren }
        }

        if (
          (n.direction === 'horizontal' && isHorizontal) ||
          (n.direction === 'vertical' && !isHorizontal)
        ) {
          let splitterIndex = isNegative ? targetIndex - 1 : targetIndex

          if (splitterIndex < 0 && n.children.length > 1) {
            splitterIndex = 0
          } else if (
            splitterIndex >= n.children.length - 1 &&
            n.children.length > 1
          ) {
            splitterIndex = n.children.length - 2
          }

          if (splitterIndex >= 0 && splitterIndex < n.children.length - 1) {
            const el = document.getElementById(n.id)
            if (el) {
              const rect = el.getBoundingClientRect()
              const parentPxSize = isHorizontal ? rect.width : rect.height
              const deltaPercent = (moveAmount / parentPxSize) * 100

              const leftChild = { ...n.children[splitterIndex] }
              const rightChild = { ...n.children[splitterIndex + 1] }

              let nl = leftChild.size + deltaPercent
              let nr = rightChild.size - deltaPercent

              if (nl < 5) {
                nl = 5
                nr = leftChild.size + rightChild.size - 5
              }
              if (nr < 5) {
                nr = 5
                nl = leftChild.size + rightChild.size - 5
              }

              const resultChildren = [...n.children]
              resultChildren[splitterIndex] = { ...leftChild, size: nl }
              resultChildren[splitterIndex + 1] = { ...rightChild, size: nr }
              return { ...n, children: resultChildren }
            }
          }
        }
      }
    }
    return n
  }
  return transform(node)
}

/**
 * High-level layout transformation function.
 * Takes the current layout node, active tile ID, and operation,
 * and returns the updated node and optionally a new active tile ID.
 */
export const executeLayoutOperation = (
  node: LayoutNode,
  activeTileId: string | null,
  operation: string,
): { node: LayoutNode; newActiveId?: string } => {
  if (operation === AppOperation.TILE_CYCLE) {
    const leafIds = getAllLeafIds(node)
    const currentIndex = activeTileId ? leafIds.indexOf(activeTileId) : -1
    const nextIndex = (currentIndex + 1) % leafIds.length
    return { node, newActiveId: leafIds[nextIndex] }
  }

  if (!activeTileId) return { node }

  switch (operation) {
    case AppOperation.TILE_SPLIT_HORIZONTAL:
      return { node: splitActiveTile(node, activeTileId, 'horizontal') }
    case AppOperation.TILE_SPLIT_VERTICAL:
      return { node: splitActiveTile(node, activeTileId, 'vertical') }
    case AppOperation.TILE_CLOSE: {
      const result = closeActiveTile(node, activeTileId)
      if (!result) return { node }
      const newLeafIds = getAllLeafIds(result)
      return {
        node: result,
        newActiveId: newLeafIds.length > 0 ? newLeafIds[0] : undefined,
      }
    }
    case AppOperation.TILE_RESIZE_LEFT:
      return { node: resizeActiveTile(node, activeTileId, 'left') }
    case AppOperation.TILE_RESIZE_RIGHT:
      return { node: resizeActiveTile(node, activeTileId, 'right') }
    case AppOperation.TILE_RESIZE_UP:
      return { node: resizeActiveTile(node, activeTileId, 'up') }
    case AppOperation.TILE_RESIZE_DOWN:
      return { node: resizeActiveTile(node, activeTileId, 'down') }
    default:
      return { node }
  }
}
