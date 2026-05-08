import React, { useCallback, useRef } from 'react'
import type { LayoutNode } from '../../../lib/constants/types'
import { useApp } from '../AppContext'
import Tile from './Tile'
import TileSplitter from './TileSplitter'

/**
 * TileNode: A recursive component that renders the Tiling Layout Tree.
 *
 * NATURE:
 * The layout is a tree structure where each node is either:
 * 1. A LEAF: A single tile containing a micro-app view.
 * 2. A SPLIT: A container that splits its space between multiple children (which are also TileNodes).
 *
 * VISUALIZATION:
 *
 * Case A: Single Tile (Root is Leaf)
 * +-----------------------+
 * |        Leaf 1         |
 * +-----------------------+
 *
 * Case B: Horizontal Split (Root is Split)
 * +-----------+-----------+
 * |           |           |
 * |  Child 1  |  Child 2  |
 * |  (Leaf)   |  (Leaf)   |
 * |           |           |
 * +-----------+-----------+
 *
 * Case C: Nested Split (Child 2 is another Split)
 * +-----------+-----------+
 * |           |  Child 2A |
 * |  Child 1  |  (Leaf)   |
 * |  (Leaf)   +-----------+
 * |           |  Child 2B |
 * |           |  (Leaf)   |
 * +-----------+-----------+
 *
 * RECURSION LOGIC:
 * - The 'isRoot' prop identifies the entry point from App.tsx.
 * - The root node uses the global 'updateLayout' from AppContext.
 * - Every nested TileNode receives an 'onUpdateLayout' callback from its parent,
 *   creating a chain that bubbles updates back to the root.
 */

interface TileNodeProps {
  node: LayoutNode
  isRoot?: boolean
  onUpdateLayout?: (newNode: LayoutNode) => void
}

const TileNode: React.FC<TileNodeProps> = ({
  node,
  isRoot,
  onUpdateLayout: onUpdateLayoutProp,
}) => {
  const {
    updateLayout: globalUpdateLayout,
    handleResizeStart,
    handleResizeEnd,
  } = useApp()
  const containerRef = useRef<HTMLDivElement>(null)

  // Use global update if root, otherwise use passed prop from parent TileNode
  const onUpdateLayout = isRoot ? globalUpdateLayout : onUpdateLayoutProp

  const handleSplitterResize = useCallback(
    (index: number, deltaPx: number) => {
      if (!containerRef.current || !onUpdateLayout) return
      const parentRect = containerRef.current.getBoundingClientRect()
      if (node.type !== 'split') return

      const isHorizontal = node.direction === 'horizontal'
      const parentPxSize = isHorizontal ? parentRect.width : parentRect.height

      if (parentPxSize <= 0) return
      const deltaPercent = (deltaPx / parentPxSize) * 100
      const newChildren = [...node.children]
      const leftChild = { ...newChildren[index] }
      const rightChild = { ...newChildren[index + 1] }

      let newLeftSize = leftChild.size + deltaPercent
      let newRightSize = rightChild.size - deltaPercent

      // Enforce minimum tile size (5%)
      if (newLeftSize < 5) {
        newLeftSize = 5
        newRightSize = leftChild.size + rightChild.size - 5
      }
      if (newRightSize < 5) {
        newRightSize = 5
        newLeftSize = leftChild.size + rightChild.size - 5
      }

      newChildren[index] = { ...leftChild, size: newLeftSize }
      newChildren[index + 1] = { ...rightChild, size: newRightSize }
      onUpdateLayout({ ...node, children: newChildren })
    },
    [node, onUpdateLayout],
  )

  // TERMINATION CASE: Render the actual Tile
  if (node.type === 'leaf') {
    const tile = <Tile node={node} />

    if (isRoot) {
      return (
        <div className="w-full h-full flex flex-col overflow-hidden">
          {tile}
        </div>
      )
    }
    return tile
  }

  // RECURSIVE CASE: Render a container with nested TileNodes
  return (
    <div
      ref={containerRef}
      id={node.id}
      className={`split ${node.direction}`}
      style={{
        flex: `${node.size} 1 0%`,
        display: 'flex',
        flexDirection: node.direction === 'horizontal' ? 'row' : 'column',
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      {node.children.map((child, index) => (
        <React.Fragment key={child.id}>
          <TileNode
            node={child}
            onUpdateLayout={(newNode) => {
              if (!onUpdateLayout) return
              const updatedChildren = [...node.children]
              updatedChildren[index] = newNode
              onUpdateLayout({ ...node, children: updatedChildren })
            }}
          />
          {index < node.children.length - 1 && (
            <TileSplitter
              direction={node.direction}
              onResize={(delta) => handleSplitterResize(index, delta)}
              onResizeStart={handleResizeStart}
              onResizeEnd={handleResizeEnd}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

export default TileNode
