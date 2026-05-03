import React, { useEffect, useRef } from 'react';
import { SelectionList, SelectionItem } from '../basic/SelectionList';
import { cn } from '../lib/utils';

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  items: SelectionItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
  className?: string;
  divided?: boolean;
}

export function ContextMenu({
  x,
  y,
  title,
  items,
  onSelect,
  onClose,
  className
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    // Use a small delay to avoid closing immediately from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Adjust position if it goes off screen
  const style: React.CSSProperties = {
    left: x,
    top: y,
  };

  // Simple adjustment for screen boundaries
  if (x > window.innerWidth - 200) style.left = x - 200;
  if (y > window.innerHeight - 300) style.top = y - 300;

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed bg-sidebar border border-border shadow-2xl rounded-xl py-1.5 z-[100] w-52 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 overflow-hidden",
        className
      )}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      {title && (
        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border/10 bg-muted/5 mb-1">
          {title}
        </div>
      )}
      <SelectionList
        items={items}
        selectedIndex={-1}
        onSelect={(item) => {
          onSelect(item.id);
          onClose();
        }}
        className="max-h-[70vh]"
      />
    </div>
  );
}
