import type { LayoutConfig } from './types'

// ─── System Layouts ─────────────────────────────────────────────────────
// These are fixed layouts for Home, Projects, and Settings.
// They cannot be modified, split, or removed.

export const HOME_LAYOUT: LayoutConfig = {
  id: 'sys-home',
  name: 'Home',
  system: true,
  fixed: true,
  layout: {
    id: 'tile-home',
    type: 'leaf',
    name: 'home',
    size: 100,
  },
}

export const PROJECTS_LAYOUT: LayoutConfig = {
  id: 'sys-projects',
  name: 'Projects',
  system: true,
  fixed: true,
  layout: {
    id: 'split-projects',
    type: 'split',
    direction: 'horizontal',
    size: 100,
    children: [
      {
        id: 'tile-projects-workspace',
        type: 'leaf',
        name: 'workspace-view',
        size: 25,
      },
      {
        id: 'tile-projects-chat',
        type: 'leaf',
        name: 'ai-browser',
        size: 75,
      },
    ],
  },
}

export const FLOWS_LAYOUT: LayoutConfig = {
  id: 'sys-flows',
  name: 'Flows',
  system: true,
  fixed: true,
  layout: {
    id: 'tile-flows',
    type: 'leaf',
    name: 'flows-view',
    size: 100,
  },
}

export const SETTINGS_LAYOUT: LayoutConfig = {
  id: 'sys-settings',
  name: 'Settings',
  system: true,
  fixed: true,
  layout: {
    id: 'tile-settings',
    type: 'leaf',
    name: 'settings',
    size: 100,
  },
}

export const SYSTEM_LAYOUTS: LayoutConfig[] = [
  HOME_LAYOUT,
  PROJECTS_LAYOUT,
  FLOWS_LAYOUT,
  SETTINGS_LAYOUT,
]
