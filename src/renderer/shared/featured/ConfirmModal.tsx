import { Button } from '../basic/Button'
import { Modal } from '../basic/Modal'

interface ConfirmModalProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  title?: string
}

function ConfirmModal({
  message,
  onConfirm,
  onCancel,
  title = 'Confirm Deletion',
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirm
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground break-words">{message}</p>
    </Modal>
  )
}
