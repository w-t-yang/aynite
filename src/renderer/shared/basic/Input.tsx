import type React from 'react'
import { forwardRef } from 'react'
import { SECTION_LABEL } from '../../../lib/constants/renderer/styles'
import { cn } from '../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  unstyled?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, unstyled, ...props }, ref) => {
    const inputId = id || 'input-field'
    return (
      <div className={cn('flex flex-col gap-1.5', unstyled ? '' : 'w-full')}>
        {label && (
          <label htmlFor={inputId} className={SECTION_LABEL}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            unstyled
              ? 'bg-transparent border-none p-0 focus:outline-none focus:ring-0'
              : 'w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)

Input.displayName = 'Input'
