import React, { useState, useEffect, useRef } from 'react';

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
  const listRef = useRef<HTMLDivElement>(null);

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
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-sidebar border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search input */}
        <div className="p-3 border-b border-border/50">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search open tabs..."
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Tab list */}
        <div ref={listRef} className="overflow-y-auto max-h-[40vh] py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matching tabs
            </div>
          ) : (
            filtered.map((tab, index) => {
              const isSelected = index === selectedIndex;
              const isActive = tab.id === activeTabId;
              const icon = tab.type === 'settings' ? '⚙️' : '📄';

              return (
                <button
                  key={tab.id}
                  className={`w-full text-left px-4 py-2.5 transition-colors flex items-center gap-3 ${
                    isSelected
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'text-foreground hover:bg-accent/50'
                  }`}
                  onClick={() => { onSelect(tab.id); onClose(); }}
                >
                  <span className="text-base shrink-0 opacity-80">{icon}</span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {tab.title}
                      {isActive && (
                        <span className="ml-2 text-[10px] opacity-50 font-normal">(active)</span>
                      )}
                    </span>
                    {tab.filepath && (
                      <span className={`text-[10px] truncate opacity-40 ${isSelected ? 'text-blue-300' : ''}`}>
                        {tab.filepath}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-3 py-2 border-t border-border/30 flex items-center gap-3 text-[10px] text-muted-foreground/50 bg-muted/10">
          <span>↑↓ or Ctrl+P/N navigate</span>
          <span>Enter select</span>
          <span>Esc/Ctrl+G close</span>
        </div>
      </div>
    </div>
  );
}
