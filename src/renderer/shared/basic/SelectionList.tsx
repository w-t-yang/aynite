import React, { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

export interface SelectionItem {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  isActive?: boolean;
  badge?: string;
  [key: string]: any;
}

interface SelectionListProps {
  items: SelectionItem[];
  selectedIndex: number;
  onSelect: (item: SelectionItem) => void;
  className?: string;
  itemClassName?: string;
  labelClassName?: string;
  subtitleClassName?: string;
  divided?: boolean;
}

export function SelectionList({
  items,
  selectedIndex,
  onSelect,
  className,
  itemClassName,
  labelClassName = "text-xs",
  subtitleClassName = "text-xxs",
  divided = true
}: SelectionListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-muted-foreground italic">
        No results
      </div>
    );
  }

  return (
    <div 
      ref={listRef} 
      className={cn("overflow-y-auto py-1 scrollbar-thin", className)}
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        return (
          <React.Fragment key={item.id}>
            {index > 0 && divided && (
              <div className="h-px bg-border/40 my-1 mx-1 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => onSelect(item)}
              className={cn(
                "w-full text-left px-3 py-1.5 transition-colors flex items-center gap-3 group outline-none",
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : "text-foreground hover:bg-primary/10 hover:text-primary",
                itemClassName
              )}
            >
              {item.icon && (
                <span className={cn(
                  "shrink-0 opacity-70",
                  isSelected ? "opacity-100" : "group-hover:opacity-100"
                )}>
                  {item.icon}
                </span>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("truncate font-medium", labelClassName)}>
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider",
                        isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {item.isActive && (
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isSelected ? "bg-primary-foreground" : "bg-primary"
                      )} />
                    )}
                  </div>
                </div>
                {item.subtitle && (
                  <span className={cn(
                    "truncate opacity-50",
                    subtitleClassName,
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {item.subtitle}
                  </span>
                )}
              </div>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
