import type React from 'react'
import { cn } from '../lib/utils'

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Radio({ className, label, ...props }: RadioProps) {
  return (
    <label
      className={cn('flex items-center gap-2 cursor-pointer group', className)}
    >
      <input
        type="radio"
        className="w-4 h-4 text-primary border-border bg-transparent focus:ring-primary focus:ring-offset-0 cursor-pointer transition-all checked:border-primary"
        {...props}
      />
      {label && (
        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
      )}
    </label>
  )
}
