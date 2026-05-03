import React from 'react';
import { cn } from '../lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ className, label, options, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full relative">
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={cn(
            "w-full bg-transparent border-b border-border/60 py-1 pr-8 text-sm focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-background text-foreground">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
      </div>
    </div>
  );
}
