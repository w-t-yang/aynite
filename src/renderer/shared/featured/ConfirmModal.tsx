import React from 'react';
import { Modal } from '../basic/Modal';
import { Button } from '../basic/Button';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
}

export function ConfirmModal({ message, onConfirm, onCancel, title = "Confirm Deletion" }: ConfirmModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Confirm</Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground break-words">{message}</p>
    </Modal>
  );
}
