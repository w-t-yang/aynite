import type React from 'react'
import { cn } from '../lib/utils'

interface ViewHeaderProps {
  icon?: React.ReactNode
  title: string
  children?: React.ReactNode
  className?: string
}

export const ICON_BTN_CLS =
  'p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'

export const iconBtn = (overrides?: string) => cn(ICON_BTN_CLS, overrides)

export function ViewHeader({ icon, title, children, className }: ViewHeaderProps) {
  return (
    <div
      className={cn(
        'h-10 border-b border-border flex items-center px-4 gap-3 bg-muted/30 justify-between shrink-0 relative z-30',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-widest truncate">
          {title}
        </span>
      </div>
      {children && (
        <div className="flex items-center gap-1 shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}
