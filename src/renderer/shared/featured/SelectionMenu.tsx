import React, { useState, useRef, useEffect, useMemo } from 'react';
import { SelectionList, SelectionItem } from '../basic/SelectionList';
import { Input } from '../basic/Input';
import { Search, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SelectionMenuProps {
  items: SelectionItem[];
  onSelect: (id: string) => void;
  onClose?: () => void;
  
  // Trigger-based (Dropdown/Select style)
  trigger?: React.ReactNode;
  activeId?: string; // To show active state in trigger if it's a default Select style
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'center' | 'right';
  
  // Position-based (Context Menu style)
  x?: number;
  y?: number;
  
  // Customization
  title?: string;
  footer?: React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  menuClassName?: string;
  divided?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}


/**
 * A unified component that handles Selects, Dropdowns, and Context Menus.
 * Featured component that leverages basic SelectionList and Input primitives.
 */
export function SelectionMenu({
  items,
  onSelect,
  onClose,
  trigger,
  activeId,
  placeholder = "Select...",
  disabled = false,
  align = 'left',

  x,
  y,
  title,
  footer,
  searchable = false,
  searchPlaceholder = "Search...",
  className,
  menuClassName,
  divided = false,
  size = 'sm',
  label
}: SelectionMenuProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isControlled = typeof x === 'number' && typeof y === 'number';
  const isOpen = isControlled ? true : internalIsOpen;

  useEffect(() => {

    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    // Use a small delay to avoid immediate closing from the opening click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {

      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isControlled]);

  const handleClose = () => {
    setInternalIsOpen(false);
    setSearch('');
    onClose?.();
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    handleClose();
  };

  const filteredItems = useMemo(() => 
    items.filter((item: SelectionItem) => {
      if (!search) return true;
      const labelMatch = item.label?.toLowerCase().includes(search.toLowerCase()) ?? false;
      const subtitleMatch = item.subtitle?.toLowerCase().includes(search.toLowerCase()) ?? false;
      return labelMatch || subtitleMatch;
    }), [items, search]);



  const activeItem = useMemo(() => 
    items.find((item: SelectionItem) => item.id === activeId), [items, activeId]);

  const selectedIndex = useMemo(() => 
    filteredItems.findIndex((item: SelectionItem) => item.id === activeId), [filteredItems, activeId]);

  const alignStyles = {
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-0'
  };

  const menuStyle: React.CSSProperties = isControlled ? {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 3000
  } : {};


  // Simple boundary adjustment for context menus
  if (isControlled && x !== undefined && y !== undefined) {
    if (x > window.innerWidth - 220) menuStyle.left = x - 220;
    if (y > window.innerHeight - 300) menuStyle.top = y - 300;
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={containerRef}>
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </label>
      )}

      <div className="relative">
        {trigger ? (
          <div 
            onClick={(e) => { e.stopPropagation(); !disabled && setInternalIsOpen(!internalIsOpen); }} 
            className="cursor-pointer"
          >
            {trigger}
          </div>

        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setInternalIsOpen(!internalIsOpen)}
            className={cn(
              "w-full flex items-center justify-between bg-transparent border-b border-border/60 py-1.5 text-xs focus:outline-none focus:border-primary transition-all hover:border-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]",
              isOpen && "border-primary"
            )}
          >
            <span className={cn("truncate font-medium", !activeItem && "text-muted-foreground/50")}>
              {activeItem ? activeItem.label : placeholder}
            </span>
            <ChevronDown size={14} className={cn("transition-transform opacity-50 text-muted-foreground", isOpen && "rotate-180")} />
          </button>
        )}


        {isOpen && (
          <div
            ref={menuRef}
            style={menuStyle}
            className={cn(
              "bg-sidebar border border-border shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col ring-1 ring-black/5 min-w-[200px]",
              !isControlled && "absolute top-full mt-2 z-[2000]",
              !isControlled && alignStyles[align],
              menuClassName
            )}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {title && (
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 border-b border-border/10 bg-muted/5 shrink-0">
                {title}
              </div>
            )}

            {searchable && (
              <div className="p-2 border-b border-border/50 flex items-center gap-2 bg-accent/10 shrink-0">
                <Search size={12} className="text-muted-foreground ml-1" />
                <Input
                  autoFocus
                  unstyled
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  className="w-full text-xs py-1"
                />
              </div>
            )}

            <SelectionList
              items={filteredItems}
              selectedIndex={selectedIndex}
              onSelect={(item: SelectionItem) => handleSelect(item.id)}
              size={size}
              divided={divided}
              className="max-h-64 scrollbar-thin"
            />

            {footer && (
              <div className="border-t border-border/50 shrink-0 mt-auto">
                {footer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

