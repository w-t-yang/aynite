import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { SelectionList, SelectionItem } from '../basic/SelectionList';

import { Button } from '../basic/Button';
import { Input } from '../basic/Input';

interface SearchableSelectProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  searchPlaceholder?: string;
  footer?: React.ReactNode;
}

export function SearchableSelect({ 
  value, 
  options, 
  onChange, 
  placeholder = "Select...", 
  className,
  searchPlaceholder = "Search...",
  footer
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredItems: SelectionItem[] = options
    .filter(opt => opt.toLowerCase().includes(search.toLowerCase()))
    .map(opt => ({
      id: opt,
      label: opt,
      isActive: value === opt
    }));

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-accent/20 rounded border border-border/40 px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary transition-all hover:bg-accent/40 active:scale-[0.98]"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown size={14} className={cn("transition-transform opacity-50 text-muted-foreground", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute z-[100] mt-1.5 min-w-full w-max max-w-[320px] left-0 bg-sidebar border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 flex flex-col">
          <div className="p-2 border-b border-border/50 flex items-center gap-2 bg-accent/10 shrink-0">
            <Search size={12} className="text-muted-foreground ml-1" />
            <Input
              autoFocus
              unstyled
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-[10px] py-1"
            />
          </div>
          
          <SelectionList
            items={filteredItems}
            selectedIndex={-1} // Dropdown click-based, but we could add key nav later
            onSelect={(item) => {
              onChange(item.id);
              setIsOpen(false);
              setSearch('');
            }}
            size="sm"
            className="max-h-64"
          />

          {footer && (
            <div className="border-t border-border/50 bg-accent/5 shrink-0">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
