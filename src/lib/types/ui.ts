import type React from 'react'

export interface LayoutActions {
  setActiveTileId: (id: string | null) => void
}

export interface UIActions {
  setActiveFile: (path: string) => void
}

export interface ThemeActions {
  refreshThemes: () => Promise<void>
}

export type VibeType = 'chat' | 'file' | 'code' | 'empty'

export interface SelectionItem {
  id: string
  label?: string
  subtitle?: string
  icon?: React.ReactNode
  badge?: string
  isActive?: boolean
  disabled?: boolean
  className?: string
  type?: 'item' | 'divider' | 'danger' | string
  submenu?: SelectionItem[]
}

export interface SelectionMenuProps {
  items: SelectionItem[]
  onSelect: (id: string) => void
  onSelectSubmenu?: (parentId: string, childId: string) => void
  onClose?: () => void
  trigger?: React.ReactNode
  activeId?: string
  placeholder?: string
  disabled?: boolean
  align?: 'left' | 'center' | 'right'
  side?: 'top' | 'bottom'
  x?: number
  y?: number
  title?: string
  footer?: React.ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
  menuClassName?: string
  divided?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export interface ChatInputHandle {
  focus: () => void
  clear: () => void
  trigger: (prefix: string) => void
}

export interface SuggestionListHandle {
  onKeyDown: (props: { event: any }) => boolean
}

export interface SuggestionItem {
  id: string
  name?: string
  isDirectory?: boolean
  label?: string
  error?: string
  subtitle?: string
}
