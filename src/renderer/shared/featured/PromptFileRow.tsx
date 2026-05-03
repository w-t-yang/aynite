import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../basic/Button';

interface PromptFileRowProps {
  filePath: string;
  onDelete: () => void;
}

export function PromptFileRow({ filePath, onDelete }: PromptFileRowProps) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-accent/5 group">
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate">{filePath.split(/[\/\\]/).pop()}</span>
        <span className="text-[10px] text-muted-foreground truncate">{filePath}</span>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onDelete}
        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
