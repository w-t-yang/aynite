import { useId } from 'react'
import { FLEX_CENTER_GAP_2 } from '../../../lib/constants/renderer/styles'
import { ColorPicker } from '../basic/ColorPicker'
import { Input } from '../basic/Input'

interface ColorInputProps {
  label: string
  value: string
  onPickerChange?: (value: string) => void
  onTextChange?: (value: string) => void
  onChange?: (value: string) => void
  onBlur?: () => void
}

export function ColorInput({
  label,
  value,
  onPickerChange,
  onTextChange,
  onChange,
  onBlur,
}: ColorInputProps) {
  const inputId = useId()

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 group">
      <label
        htmlFor={inputId}
        className="text-xs text-muted-foreground group-hover:text-foreground transition-colors"
      >
        {label}
      </label>
      <div className={FLEX_CENTER_GAP_2}>
        <ColorPicker
          value={value}
          onChange={(e) => {
            const val = e.target.value
            if (onPickerChange) onPickerChange(val)
            if (onChange) onChange(val)
          }}
        />
        <Input
          id={inputId}
          unstyled
          type="text"
          value={value}
          onChange={(e) => {
            const val = e.target.value
            if (onTextChange) onTextChange(val)
            if (onChange) onChange(val)
          }}
          onBlur={onBlur}
          className="w-20 bg-accent/20 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-mono"
        />
      </div>
    </div>
  )
}
