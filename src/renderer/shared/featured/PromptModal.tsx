import { Button } from '../basic/Button'
import { Input } from '../basic/Input'
import { Modal } from '../basic/Modal'

interface PromptModalProps {
  title: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onConfirm: (v: string) => void
  onCancel: () => void
}

function PromptModal({
  title,
  placeholder,
  value,
  onChange,
  onConfirm,
  onCancel,
}: PromptModalProps) {
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
          <Button
            variant="primary"
            onClick={() => value.trim() && onConfirm(value.trim())}
            disabled={!value.trim()}
          >
            Confirm
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    </Modal>
  )
}
