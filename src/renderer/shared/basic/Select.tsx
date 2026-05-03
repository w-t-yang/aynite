import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { ChevronDown, Search } from 'lucide-react';
import { SelectionList, SelectionItem } from './SelectionList';
import { Input } from './Input';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: (SelectOption | string)[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function Select({ 
  label, 
  value, 
  options, 
  onChange, 
  placeholder = "Select...", 
  className,
  searchable = false,
  searchPlaceholder = "Search...",
  disabled = false
}: SelectProps) {
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

  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const filteredItems: SelectionItem[] = normalizedOptions
    .filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))
    .map(opt => ({
      id: opt.value,
      label: opt.label,
      isActive: value === opt.value
    }));

  const activeOption = normalizedOptions.find(opt => opt.value === value);

  return (
    <div className={cn("flex flex-col gap-1.5 w-full relative", className)} ref={containerRef}>
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {label}
        </label>
      )}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-transparent border-b border-border/60 py-1 text-sm focus:outline-none focus:border-primary transition-all hover:border-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          isOpen && "border-primary"
        )}
      >
        <span className={cn("truncate", !activeOption && "text-muted-foreground/50")}>
          {activeOption ? activeOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={cn("transition-transform opacity-50 text-muted-foreground", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute z-[100] mt-1 top-full left-0 min-w-full w-max max-w-[320px] bg-sidebar border border-border shadow-2xl rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5 flex flex-col">
          {searchable && (
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
          )}
          
          <SelectionList
            items={filteredItems}
            selectedIndex={-1}
            onSelect={(item) => {
              onChange(item.id);
              setIsOpen(false);
              setSearch('');
            }}
            size="sm"
            className="max-h-64"
          />
        </div>
      )}
    </div>
  );
}
