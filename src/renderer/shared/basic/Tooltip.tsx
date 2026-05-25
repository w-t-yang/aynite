import type React from 'react'
import { cn } from '../lib/utils'

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
}

/**
 * A simple CSS-based tooltip that shows on hover.
 * Uses group-hover to toggle visibility without JavaScript.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <div className={cn('relative group/tooltip', className)}>
      {children}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 mb-1.5
          opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 z-popover
          whitespace-nowrap px-2 py-1 rounded text-[11px] leading-none
          bg-popover text-popover-foreground border border-border shadow-lg"
      >
        {content}
      </div>
    </div>
  )
}
