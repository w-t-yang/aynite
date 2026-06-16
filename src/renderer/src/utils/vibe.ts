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
      {
        id: 'vibe-chat-sessions',
        type: 'leaf',
        name: 'workspace-view',
        size: 30,
      },
      { id: 'vibe-chat-ai', type: 'leaf', name: 'ai-browser', size: 70 },
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
  empty: {
    id: 'vibe-empty',
    type: 'leaf',
    size: 100,
    // no `name` property — renders as an empty tile with no view configured
  },
  surprise: {
    id: 'vibe-surprise',
    type: 'leaf',
    size: 100,
    // surprise: show a random view
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
