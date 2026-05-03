import React from 'react';
import { cn } from '../lib/utils';

interface ColorPickerProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function ColorPicker({ className, label, ...props }: ColorPickerProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </label>
      )}
      <input
        type="color"
        className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent transition-all hover:scale-105 active:scale-95"
        {...props}
      />
    </div>
  );
}
