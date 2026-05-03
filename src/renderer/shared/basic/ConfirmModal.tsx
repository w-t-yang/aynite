import React from 'react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
}

export function ConfirmModal({ message, onConfirm, onCancel, title = "Confirm Deletion" }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
        <h3 className="text-lg font-medium mb-4 text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mb-6 break-words">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-destructive text-destructive-foreground hover:opacity-90 rounded-md transition-colors font-medium">Confirm</button>
        </div>
      </div>
    </div>
  );
}
