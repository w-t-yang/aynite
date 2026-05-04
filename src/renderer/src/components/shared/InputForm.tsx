import React, { useState } from 'react'
import Button from './Button'

interface InputFormProps {
  label: string
  placeholder?: string
  submitLabel?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

const InputForm: React.FC<InputFormProps> = ({
  label,
  placeholder,
  submitLabel = 'Submit',
  onSubmit,
  onCancel
}) => {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-4">
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
          {label}
        </label>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-sidebar border border-border rounded-xl px-4 py-3 text-[14px] text-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1 rounded-xl"
          type="submit"
          disabled={!value.trim()}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default InputForm
