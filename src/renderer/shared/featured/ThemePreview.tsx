import React from 'react';
import { cn } from '../lib/utils';

import { Button } from '../basic/Button';

interface ThemePreviewProps {
  theme: any;
  isActive: boolean;
  onClick: () => void;
}

export function ThemePreview({ theme, isActive, onClick }: ThemePreviewProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all w-full h-auto",
        isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
      )}
    >
      <div
        className="w-20 h-14 rounded-md border flex items-center justify-center shadow-sm overflow-hidden"
        style={{ background: theme.colors?.background, borderColor: theme.colors?.border }}
      >
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: theme.colors?.primary }} />
          <div className="w-3 h-3 rounded-full" style={{ background: theme.colors?.accent }} />
          <div className="w-3 h-3 rounded-full" style={{ background: theme.colors?.destructive }} />
        </div>
      </div>
      <span className="text-xs font-medium">{theme.name}</span>
    </Button>
  );
}
