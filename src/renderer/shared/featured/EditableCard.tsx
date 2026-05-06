import { Trash2 } from 'lucide-react'
import type React from 'react'
import { Button } from '../basic/Button'
import { Input } from '../basic/Input'
import { Modal } from '../basic/Modal'
import { Radio } from '../basic/Radio'
import {
  DESCRIPTION_TEXT,
  FLEX_CENTER_BETWEEN,
  FLEX_CENTER_GAP_3,
} from '../lib/styles'
import { cn } from '../lib/utils'

export function EditableCardFrame({
  isActive,
  children,
}: {
  isActive: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'p-5 rounded-xl border transition-all space-y-4',
        isActive ? 'border-primary bg-accent/5' : 'border-border bg-accent/5',
      )}
    >
      {children}
    </div>
  )
}

interface EditableCardHeaderProps {
  radioName: string
  isActive: boolean
  onSetActive: () => void
  itemName: string
  onNameChange: (name: string) => void
  placeholder: string
  onDeleteRequest: () => void
}

export function EditableCardHeader({
  radioName,
  isActive,
  onSetActive,
  itemName,
  onNameChange,
  placeholder,
  onDeleteRequest,
}: EditableCardHeaderProps) {
  return (
    <div className={FLEX_CENTER_BETWEEN}>
      <div className={FLEX_CENTER_GAP_3}>
        <Radio name={radioName} checked={isActive} onChange={onSetActive} />
        <Input
          unstyled
          className="font-bold w-64"
          value={itemName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDeleteRequest}
        className="hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 size={16} />
      </Button>
    </div>
  )
}

interface DeleteItemModalProps {
  isOpen: boolean
  onClose: () => void
  onDelete: () => void
  title: string
  itemName: string
  deleteLabel: string
  children?: React.ReactNode
}

export function DeleteItemModal({
  isOpen,
  onClose,
  onDelete,
  title,
  itemName,
  deleteLabel,
  children,
}: DeleteItemModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            {deleteLabel}
          </Button>
        </>
      }
    >
      {children || (
        <p className={DESCRIPTION_TEXT}>
          Are you sure you want to delete{' '}
          <span className="font-bold text-foreground">"{itemName}"</span>?
        </p>
      )}
    </Modal>
  )
}
