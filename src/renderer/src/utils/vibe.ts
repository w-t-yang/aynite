import type { LayoutNode } from '../../../lib/constants/types'
import type { VibeType } from '../../../lib/types/ui'

export type { VibeType }

const VIBE_LAYOUTS: Record<VibeType, LayoutNode> = {
  chat: {
    id: 'vibe-chat',
    type: 'split',
    direction: 'horizontal',
    size: 100,
    children: [
      { id: 'vibe-chat-tree', type: 'leaf', name: 'treeview', size: 30 },
      { id: 'vibe-chat-ai', type: 'leaf', name: 'aichat', size: 70 },
    ],
  },
  file: {
    id: 'vibe-file',
    type: 'split',
    direction: 'horizontal',
    size: 100,
    children: [
      { id: 'vibe-file-tree', type: 'leaf', name: 'treeview', size: 30 },
      { id: 'vibe-file-browser', type: 'leaf', name: 'file-browser', size: 70 },
    ],
  },
  code: {
    id: 'vibe-code',
    type: 'split',
    direction: 'horizontal',
    size: 100,
    children: [
      { id: 'vibe-code-tree', type: 'leaf', name: 'treeview', size: 20 },
      { id: 'vibe-code-browser', type: 'leaf', name: 'file-browser', size: 50 },
      { id: 'vibe-code-ai', type: 'leaf', name: 'aichat', size: 30 },
    ],
  },
  surprise: {
    id: 'vibe-surprise',
    type: 'split',
    direction: 'vertical',
    size: 100,
    children: [
      { id: 'vibe-surp-tree', type: 'leaf', name: 'treeview', size: 25 },
      {
        id: 'split-vibe-surp',
        type: 'split',
        direction: 'horizontal',
        size: 75,
        children: [
          {
            id: 'vibe-surp-browser',
            type: 'leaf',
            name: 'file-browser',
            size: 50,
          },
          { id: 'vibe-surp-ai', type: 'leaf', name: 'aichat', size: 50 },
        ],
      },
    ],
  },
}

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
