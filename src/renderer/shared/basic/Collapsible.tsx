import { ChevronRight } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { cn } from '../lib/utils'

interface CollapsibleProps {
  title: string
  icon?: any
  colorClass: string
  children: React.ReactNode
  defaultExpanded?: boolean
  borderPosition?: 'left' | 'bottom'
  compact?: boolean
}

export function Collapsible({
  title,
  icon: Icon,
  colorClass,
  children,
  defaultExpanded = false,
  borderPosition = 'left',
  compact = false,
}: CollapsibleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const textColor = colorClass.replace('border-', 'text-').replace(/\/.*$/, '')
  const borderStyle =
    borderPosition === 'left' ? `border-l-2 ${colorClass}` : ''

  return (
    <div
      className={cn(
        'my-1 bg-muted/5 rounded-r overflow-hidden transition-all duration-200',
        borderStyle,
        compact ? 'py-1' : 'py-1.5',
        'px-2',
      )}
    >
      <div className="flex items-center justify-between group">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
            {Icon && <Icon size={compact ? 10 : 12} className={textColor} />}
            <span>{title}</span>
          </div>
          <ChevronRight
            size={compact ? 8 : 10}
            className={cn(
              'text-muted-foreground/40 group-hover:text-primary transition-transform duration-200',
              expanded && 'rotate-90',
            )}
          />
        </button>
      </div>
      {expanded && (
        <div
          className={cn(
            'border-t border-border/10 animate-in fade-in slide-in-from-top-1 duration-200',
            compact ? 'mt-1 pt-1' : 'mt-2 pt-2',
          )}
        >
          {children}
        </div>
      )}
      {borderPosition === 'bottom' && (
        <div
          className={cn(
            'border-b opacity-50',
            colorClass,
            compact ? '-mx-2 mt-1' : '-mx-3 mt-2',
          )}
        />
      )}
    </div>
  )
}
