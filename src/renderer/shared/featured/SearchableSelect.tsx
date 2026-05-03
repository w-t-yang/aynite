import React from 'react';
import { Select } from '../basic/Select';

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
  return (
    <Select
      searchable
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      searchPlaceholder={searchPlaceholder}
    />
  );
}
