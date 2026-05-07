import type React from 'react'

export interface SelectionItem {
  id: string
  label?: string
  subtitle?: string
  description?: string
  icon?: React.ReactNode
  isActive?: boolean
  badge?: string
  metadata?: any
  [key: string]: any
}

export interface SuggestionItem extends SelectionItem {
  name?: string
  isDirectory?: boolean
  type?: 'file' | 'skill' | 'command' | 'provider' | 'model' | 'agent'
}

export interface ChatInputHandle {
  focus: () => void
  clear: () => void
  trigger: (prefix: string) => void
}

export interface SuggestionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export interface SelectionMenuProps {
  items: SelectionItem[]
  onSelect: (id: string) => void
  onClose?: () => void

  // Trigger-based (Dropdown/Select style)
  trigger?: React.ReactNode
  activeId?: string
  placeholder?: string
  disabled?: boolean
  align?: 'left' | 'center' | 'right'

  // Position-based (Context Menu style)
  x?: number
  y?: number

  // Customization
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
