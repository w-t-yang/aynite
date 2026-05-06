import type React from 'react'
import { cn } from '../lib/utils'

interface ColorPickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

import { SECTION_LABEL } from '../lib/styles'
export function ColorPicker({
  className,
  label,
  id,
  ...props
}: ColorPickerProps) {
  const inputId = id || 'color-picker-input'
  const value = props.value as string
  const sanitizedValue =
    typeof value === 'string' && value.startsWith('#') ? value : '#000000'

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className={SECTION_LABEL}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="color"
        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent transition-all hover:scale-105 active:scale-95"
        {...props}
        value={sanitizedValue}
      />
    </div>
  )
}
