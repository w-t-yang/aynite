import type { LayoutNode } from '../../../lib/constants/types'

export type VibeType = 'chat' | 'file' | 'code' | 'surprise'

export function getVibeLayout(type: VibeType): LayoutNode {
  const id = () => Math.random().toString(36).slice(2, 10)

  switch (type) {
    case 'chat':
      return {
        id: id(),
        type: 'split',
        direction: 'horizontal',
        size: 100,
        children: [
          {
            id: id(),
            type: 'leaf',
            name: 'session-view',
            size: 30,
          },
          {
            id: id(),
            type: 'leaf',
            name: 'aichat',
            size: 70,
          },
        ],
      }
    case 'file':
      return {
        id: id(),
        type: 'split',
        direction: 'horizontal',
        size: 100,
        children: [
          {
            id: id(),
            type: 'leaf',
            name: 'treeview',
            size: 30,
          },
          {
            id: id(),
            type: 'leaf',
            name: 'file-browser',
            size: 70,
          },
        ],
      }
    case 'code':
      return {
        id: id(),
        type: 'split',
        direction: 'horizontal',
        size: 100,
        children: [
          {
            id: id(),
            type: 'leaf',
            name: 'treeview',
            size: 20,
          },
          {
            id: id(),
            type: 'leaf',
            name: 'file-browser',
            size: 50,
          },
          {
            id: id(),
            type: 'leaf',
            name: 'aichat',
            size: 30,
          },
        ],
      }
    default:
      return {
        id: id(),
        type: 'leaf',
        name: '',
        size: 100,
      }
  }
}
