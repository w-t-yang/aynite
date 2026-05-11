import { useState } from 'react'
import { Button } from '../../../shared/basic/Button'
import { Input } from '../../../shared/basic/Input'
import { Modal } from '../../../shared/basic/Modal'

interface AddGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (name: string) => void
}

export function AddGroupModal({
  isOpen,
  onClose,
  onSubmit,
}: AddGroupModalProps) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSubmit(name.trim())
      setName('')
      onClose()
    }
  }

  const handleClose = () => {
    setName('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Group" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          autoFocus
          label="Group Name"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setName(e.target.value)
          }
          placeholder="e.g., Technology"
        />
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            type="submit"
            disabled={!name.trim()}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}
