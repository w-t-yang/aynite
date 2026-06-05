import type React from 'react'
import { cn } from '../lib/utils'

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
  /** Tooltip position relative to the trigger element. Default: 'top' */
  position?: 'top' | 'bottom'
  /** Horizontal alignment relative to the trigger. Default: 'left' */
  align?: 'left' | 'right'
}

const positionClasses: Record<string, string> = {
  top: 'bottom-full mb-1.5',
  bottom: 'top-full mt-1.5',
}

const alignClasses: Record<string, string> = {
  left: 'left-0',
  right: 'right-0',
}

/**
 * A simple CSS-based tooltip that shows on hover.
 * Uses group-hover to toggle visibility without JavaScript.
 * When `content` contains newlines, it renders as a multi-line tooltip.
 */
export function Tooltip({
  content,
  children,
  className,
  position = 'top',
  align = 'left',
}: TooltipProps) {
  const isMultiLine = content.includes('\n')
  return (
    <div className={cn('relative group/tooltip', className)}>
      {children}
      <div
        role="tooltip"
        className={cn(
          'pointer-events-none absolute',
          positionClasses[position],
          alignClasses[align],
          'opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 z-popover',
          isMultiLine
            ? 'whitespace-pre-line px-3 py-1.5 rounded text-[11px] leading-relaxed min-w-[160px]'
            : 'whitespace-nowrap px-2 py-1 rounded text-[11px] leading-none',
          'bg-popover text-popover-foreground border border-border shadow-lg',
        )}
      >
        {content}
      </div>
    </div>
  )
}
