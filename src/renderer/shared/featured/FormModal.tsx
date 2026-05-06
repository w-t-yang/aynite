import type React from 'react'
import { useState } from 'react'
import { Button } from '../basic/Button'
import { Input } from '../basic/Input'
import { Modal } from '../basic/Modal'

interface FormModalProps {
  title: string
  label: string
  placeholder?: string
  submitLabel?: string
  onSubmit: (value: string) => void
  onClose: () => void
}

export function FormModal({
  title,
  label,
  placeholder,
  submitLabel = 'Submit',
  onSubmit,
  onClose,
}: FormModalProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
      onClose()
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          autoFocus
          label={label}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setValue(e.target.value)
          }
          placeholder={placeholder}
        />
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            type="submit"
            disabled={!value.trim()}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
