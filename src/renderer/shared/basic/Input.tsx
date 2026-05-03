import React from 'react';
import { cn } from '../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  unstyled?: boolean;
}

export function Input({ className, label, unstyled, ...props }: InputProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", unstyled ? "" : "w-full")}>
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </label>
      )}
      <input
        className={cn(
          unstyled 
            ? "bg-transparent border-none p-0 focus:outline-none focus:ring-0" 
            : "w-full bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50",
          className
        )}
        {...props}
      />
    </div>
  );
}
