import type { LayoutConfig } from './types'

// ─── System Layouts ─────────────────────────────────────────────────────
// These are fixed layouts for Home, Projects, and Settings.
// They cannot be modified, split, or removed.

export const HOME_LAYOUT: LayoutConfig = {
  id: 'sys-home',
  name: 'Home',
  system: true,
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
  layout: {
    id: 'tile-projects',
    type: 'leaf',
    name: 'projects-view',
    size: 100,
  },
}

export const SETTINGS_LAYOUT: LayoutConfig = {
  id: 'sys-settings',
  name: 'Settings',
  system: true,
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
  SETTINGS_LAYOUT,
]
