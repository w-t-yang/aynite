import { VIBE_LAYOUTS } from '../../../lib/constants/layout'
import type { LayoutNode } from '../../../lib/constants/types'

export type VibeType = 'chat' | 'file' | 'code' | 'surprise'

function cloneWithNewIds(node: LayoutNode): LayoutNode {
  const newId = () => Math.random().toString(36).slice(2, 10)

  if (node.type === 'leaf') {
    return {
      ...node,
      id: newId(),
    }
  }

  return {
    ...node,
    id: newId(),
    children: node.children.map((child) => cloneWithNewIds(child)),
  }
}

export function getVibeLayout(type: VibeType): LayoutNode {
  const template = VIBE_LAYOUTS[type] || VIBE_LAYOUTS.surprise
  return cloneWithNewIds(template)
}
