import type { WorkspaceConfig } from './types'

export const DEFAULT_WORKSPACE_ID = 'Aynite Playbook'

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  id: DEFAULT_WORKSPACE_ID,
  layouts: [
    {
      id: 'layout-1',
      name: 'Single',
      layout: { type: 'leaf', id: 'tile-1', content: 'Main', size: 100 },
    },
    {
      id: 'layout-2',
      name: 'Sidebar',
      layout: {
        type: 'split',
        direction: 'horizontal',
        id: 'split-sidebar',
        size: 100,
        children: [
          {
            type: 'leaf',
            id: 'tile-sidebar-left',
            content: 'Sidebar',
            size: 25,
          },
          { type: 'leaf', id: 'tile-sidebar-main', content: 'Main', size: 75 },
        ],
      },
    },
    {
      id: 'layout-3',
      name: 'Three Columns',
      layout: {
        type: 'split',
        direction: 'horizontal',
        id: 'split-3col',
        size: 100,
        children: [
          { type: 'leaf', id: 'tile-3col-1', content: 'Left', size: 20 },
          { type: 'leaf', id: 'tile-3col-2', content: 'Center', size: 60 },
          { type: 'leaf', id: 'tile-3col-3', content: 'Right', size: 20 },
        ],
      },
    },
  ],
  activeLayoutId: 'layout-1',
  folders: [],
  files: [],
}
