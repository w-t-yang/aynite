import React from 'react'
import Modal from '../Modal'
import InputForm from '../InputForm'

interface FormModalProps {
  title: string
  label: string
  placeholder?: string
  submitLabel?: string
  onSubmit: (value: string) => void
  onClose: () => void
}

const FormModal: React.FC<FormModalProps> = ({
  title,
  label,
  placeholder,
  submitLabel = 'Submit',
  onSubmit,
  onClose
}) => {
  return (
    <Modal onClose={onClose} title={title}>
      <InputForm
        label={label}
        placeholder={placeholder}
        submitLabel={submitLabel}
        onSubmit={(val) => {
          onSubmit(val)
          onClose()
        }}
        onCancel={onClose}
      />
    </Modal>
  )
}

export default FormModal
