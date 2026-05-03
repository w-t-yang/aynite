import React from 'react';
import { cn } from '../lib/utils';

interface SettingsPageProps {
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsPage({ 
  title, 
  description, 
  primaryAction, 
  children,
  className 
}: SettingsPageProps) {
  return (
    <div className="flex-1 flex flex-col min-w-[800px] overflow-x-auto bg-background">
      <div className={cn("p-10 space-y-12", className)}>
        {/* Header */}
        <div className="flex items-start justify-between gap-8">
          <div className="space-y-1.5 flex-1">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
            <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
              {description}
            </p>
          </div>
          {primaryAction && (
            <div className="shrink-0 pt-1">
              {primaryAction}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-12 pb-20">
          {children}
        </div>
      </div>
    </div>
  );
}
