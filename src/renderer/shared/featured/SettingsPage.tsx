import React from 'react';
import { cn } from '../lib/utils';
import { Button } from '../basic/Button';
import { RotateCcw } from 'lucide-react';

interface SettingsPageProps {
  title: string;
  description: string;
  onRestore?: () => void;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsPage({ 
  title, 
  description, 
  onRestore, 
  primaryAction,
  children,
  className 
}: SettingsPageProps) {
  return (
    <div className="flex-1 overflow-auto bg-background custom-scrollbar">
      <div className={cn("w-[800px] mx-auto p-10 space-y-12 shrink-0", className)}>
        {/* Header */}
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
          <div className="flex items-start justify-between gap-8">
            <p className="text-muted-foreground text-sm flex-1 leading-relaxed">
              {description}
            </p>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {primaryAction}
              {onRestore && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onRestore} 
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground h-auto py-1"
                >
                  <RotateCcw size={14} /> Restore Defaults
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-12 pb-20">
          {children}
        </div>
      </div>
    </div>
  );
}
