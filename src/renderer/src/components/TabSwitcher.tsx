import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Settings as SettingsIcon } from 'lucide-react';
import { SelectionList, SelectionItem } from './ui/SelectionList';

interface TabItem {
  id: string;
  title: string;
  filepath?: string;
  type: string;
}

interface TabSwitcherProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose: () => void;
}

export default function TabSwitcher({ tabs, activeTabId, onSelect, onClose }: TabSwitcherProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = tabs.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    (t.filepath && t.filepath.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape' || (isCtrl && e.key.toUpperCase() === 'G')) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].id);
          onClose();
        }
        return;
      }

      // Arrow Up or Ctrl+P
      if (e.key === 'ArrowUp' || (isCtrl && e.key.toUpperCase() === 'P')) {
        e.preventDefault();
        setSelectedIndex(prev => (prev + filtered.length - 1) % filtered.length);
        return;
      }

      // Arrow Down or Ctrl+N
      if (e.key === 'ArrowDown' || (isCtrl && e.key.toUpperCase() === 'N')) {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filtered, selectedIndex, onClose, onSelect]);

  const selectionItems: SelectionItem[] = filtered.map(tab => ({
    id: tab.id,
    label: tab.title,
    subtitle: tab.filepath,
    isActive: tab.id === activeTabId,
    icon: tab.type === 'settings' ? <SettingsIcon size={16} /> : <FileText size={16} />
  }));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-sidebar border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Search input */}
        <div className="p-3 border-b border-border/50 bg-accent/10 flex items-center gap-3">
          <Search size={16} className="text-muted-foreground ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search open tabs..."
            className="w-full bg-transparent border-none focus:outline-none text-sm py-1 placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Tab list */}
        <SelectionList
          items={selectionItems}
          selectedIndex={selectedIndex}
          onSelect={(item) => {
            onSelect(item.id);
            onClose();
          }}
          className="max-h-[50vh]"
        />

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground/40 bg-muted/5">
          <div className="flex items-center gap-1.5">
            <span className="px-1 py-0.5 rounded border border-border bg-accent/20">↑↓</span> navigate
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1 py-0.5 rounded border border-border bg-accent/20">Enter</span> select
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1 py-0.5 rounded border border-border bg-accent/20">Esc</span> close
          </div>
        </div>
      </div>
    </div>
  );
}
