import React from 'react';
import { SelectionList, SelectionItem } from './SelectionList';
import { cn } from '../../lib/utils';

interface SelectionPopoverProps {
  title: string;
  items: SelectionItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  className?: string;
  position?: 'top' | 'bottom';
}

/**
 * A floating popover menu that displays a SelectionList with a title header.
 */
export function SelectionPopover({
  title,
  items,
  activeId,
  onSelect,
  onClose,
  className,
  position = 'bottom'
}: SelectionPopoverProps) {
  const selectedIndex = items.findIndex(item => item.id === activeId);

  return (
    <div className={cn(
      "absolute left-0 w-64 bg-background/95 backdrop-blur-xl border border-border/40 rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-200 z-50",
      position === 'top' ? "bottom-full mb-2 slide-in-from-bottom-2" : "top-full mt-2 slide-in-from-top-2",
      className
    )}>
      <div className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/10 bg-muted/20 text-left">
        {title}
      </div>
      <SelectionList 
        items={items}
        selectedIndex={selectedIndex}
        onSelect={(item) => {
          onSelect(item.id);
          onClose();
        }}
        size="sm"
        className="max-h-64"
      />
    </div>
  );
}
