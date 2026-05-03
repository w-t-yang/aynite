import React from 'react';
import { cn } from '../lib/utils';

interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function Section({ title, description, children, action, className }: SectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="space-y-1">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground/60">
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
