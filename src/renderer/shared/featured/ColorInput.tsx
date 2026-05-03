import React from 'react';
import { Input } from '../basic/Input';

interface ColorInputProps {
  label: string;
  value: string;
  onPickerChange?: (value: string) => void;
  onTextChange?: (value: string) => void;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}

export function ColorInput({ label, value, onPickerChange, onTextChange, onChange, onBlur }: ColorInputProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20 group">
      <label className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</label>
      <div className="flex items-center gap-2">
        <input 
          type="color" 
          value={value} 
          onChange={(e) => {
            const val = e.target.value;
            if (onPickerChange) onPickerChange(val);
            if (onChange) onChange(val);
          }} 
          className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent" 
        />
        <Input
          unstyled
          type="text" 
          value={value} 
          onChange={(e) => {
            const val = e.target.value;
            if (onTextChange) onTextChange(val);
            if (onChange) onChange(val);
          }} 
          onBlur={onBlur}
          className="w-20 bg-accent/20 rounded border border-transparent px-1.5 py-0.5 text-[10px] font-mono" 
        />
      </div>
    </div>
  );
}
