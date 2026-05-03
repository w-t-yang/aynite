import React from 'react';

interface PromptModalProps {
  title: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}

export function PromptModal({ title, placeholder, value, onChange, onConfirm, onCancel }: PromptModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-sidebar border border-border shadow-xl rounded-xl p-5 w-80 max-w-[90vw]">
        <h3 className="text-lg font-medium mb-4 text-foreground">{title}</h3>
        <input 
          autoFocus
          type="text" 
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-background text-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md transition-colors">Cancel</button>
          <button onClick={() => value.trim() && onConfirm(value.trim())} className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded-md transition-colors font-medium">Confirm</button>
        </div>
      </div>
    </div>
  );
}
