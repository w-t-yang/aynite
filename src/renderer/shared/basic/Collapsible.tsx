import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleProps {
  title: string;
  icon?: any;
  colorClass: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  borderPosition?: 'left' | 'bottom';
}

export function Collapsible({
  title,
  icon: Icon,
  colorClass,
  children,
  defaultExpanded = false,
  borderPosition = 'left'
}: CollapsibleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const textColor = colorClass.replace('border-', 'text-').replace(/\/.*$/, '');
  const borderStyle = borderPosition === 'left' ? `border-l-2 ${colorClass}` : '';

  return (
    <div className={`my-1 ${borderStyle} bg-muted/5 rounded-r px-3 py-1.5 overflow-hidden transition-all duration-200`}>
      <div className="flex items-center justify-between group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
            {Icon && <Icon size={12} className={textColor} />}
            <span>{title}</span>
          </div>
          <ChevronRight size={10} className={`text-muted-foreground/40 group-hover:text-primary transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>
      {expanded && (
        <div className="mt-2 border-t border-border/10 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
      {borderPosition === 'bottom' && <div className={`border-b ${colorClass} -mx-3 mt-2 opacity-50`} />}
    </div>
  );
}
