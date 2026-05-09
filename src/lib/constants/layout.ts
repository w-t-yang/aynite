import type { LayoutConfig, LayoutNode } from './types'

export const VIBE_LAYOUTS: Record<string, LayoutNode> = {
  chat: {
    id: 'split-chat',
    type: 'split',
    direction: 'horizontal',
    size: 100,
    children: [
      { id: 'tile-chat-session', type: 'leaf', name: 'session-view', size: 30 },
      { id: 'tile-chat-main', type: 'leaf', name: 'aichat', size: 70 },
    ],
  },
  file: {
    id: 'split-file',
    type: 'split',
    direction: 'horizontal',
    size: 100,
    children: [
      { id: 'tile-file-tree', type: 'leaf', name: 'treeview', size: 30 },
      { id: 'tile-file-browser', type: 'leaf', name: 'file-browser', size: 70 },
    ],
  },
  code: {
    id: 'split-code',
    type: 'split',
    direction: 'horizontal',
    size: 100,
    children: [
      { id: 'tile-code-tree', type: 'leaf', name: 'treeview', size: 20 },
      { id: 'tile-code-browser', type: 'leaf', name: 'file-browser', size: 50 },
      { id: 'tile-code-chat', type: 'leaf', name: 'aichat', size: 30 },
    ],
  },
  surprise: {
    id: 'tile-surprise',
    type: 'leaf',
    name: '',
    size: 100,
  },
}

export const DEFAULT_LAYOUTS: LayoutConfig[] = [
  {
    id: 'layout-chat',
    name: 'Chat Vibe',
    layout: VIBE_LAYOUTS.chat,
  },
  {
    id: 'layout-file',
    name: 'File Vibe',
    layout: VIBE_LAYOUTS.file,
  },
  {
    id: 'layout-code',
    name: 'Code Vibe',
    layout: VIBE_LAYOUTS.code,
  },
]
