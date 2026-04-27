import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Eye, Save } from 'lucide-react';
import { cn } from '../lib/utils';

interface FileViewerProps {
  filename: string;
  content: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  isDirty?: boolean;
  keybindings: any;
}

export default function FileViewer({ filename, content, onChange, onSave, isDirty, keybindings }: FileViewerProps) {
  const [localContent, setLocalContent] = useState(content);
  const [isEditing, setIsEditing] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);
  const isLocalChange = useRef(false);

  useEffect(() => {
    // Only sync from parent if it's not our own change propagating back
    if (!isLocalChange.current) {
      setLocalContent(content);
    }
    isLocalChange.current = false;
  }, [content]);

  // Reset undo stack when switching files
  useEffect(() => {
    undoStack.current = [];
  }, [filename]);

  useEffect(() => {
    setIsEditing(false); // reset mode on file change
    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
      textareaRef.current.scrollLeft = 0;
      textareaRef.current.focus();
    }
  }, [filename]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [isEditing]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    undoStack.current.push(localContent);
    // Cap undo history at 100 entries
    if (undoStack.current.length > 100) undoStack.current.shift();
    setLocalContent(e.target.value);
    if (onChange) {
      isLocalChange.current = true;
      onChange(e.target.value);
    }
    updateCursor();
  };

  const moveCursor = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    let pos = textarea.selectionStart;
    const lines = localContent.split('\n');
    const getPosInfo = (p: number) => {
      const before = localContent.substring(0, p);
      const l = before.split('\n').length - 1;
      const c = before.split('\n').slice(-1)[0].length;
      return { l, c };
    };
    
    const { l, c } = getPosInfo(pos);

    if (dir === 'up' && l > 0) {
      const prevLineLength = lines[l - 1].length;
      const targetCol = Math.min(c, prevLineLength);
      let newPos = 0;
      for (let i = 0; i < l - 1; i++) newPos += lines[i].length + 1;
      pos = newPos + targetCol;
    } else if (dir === 'down' && l < lines.length - 1) {
      const nextLineLength = lines[l + 1].length;
      const targetCol = Math.min(c, nextLineLength);
      let newPos = 0;
      for (let i = 0; i <= l; i++) newPos += lines[i].length + 1;
      pos = newPos + targetCol;
    } else if (dir === 'left' && pos > 0) {
      pos--;
    } else if (dir === 'right' && pos < localContent.length) {
      pos++;
    }

    textarea.selectionStart = textarea.selectionEnd = pos;
    textarea.focus();
    updateCursor();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }
    const results: number[] = [];
    let pos = localContent.indexOf(query);
    while (pos !== -1) {
      results.push(pos);
      pos = localContent.indexOf(query, pos + 1);
    }
    setSearchResults(results);
    if (results.length > 0) {
      setCurrentSearchIndex(0);
      jumpToSearchResult(results[0]);
    } else {
      setCurrentSearchIndex(-1);
    }
  };

  const jumpToSearchResult = (pos: number) => {
    if (!textareaRef.current) return;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos + searchQuery.length);
    updateCursor();
    // Scroll into view
    const textarea = textareaRef.current;
    const lineHeight = 24; // 1.5rem
    const charWidth = 8;
    const beforeResults = localContent.substring(0, pos);
    const line = beforeResults.split('\n').length - 1;
    textarea.scrollTop = line * lineHeight - (textarea.clientHeight / 2);
  };

  const nextSearch = () => {
    if (searchResults.length > 0) {
      const nextIdx = (currentSearchIndex + 1) % searchResults.length;
      setCurrentSearchIndex(nextIdx);
      jumpToSearchResult(searchResults[nextIdx]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Explicitly ignore Ctrl + \ or Super + \ to allow system input method switching
      if ((e.ctrlKey || e.metaKey) && (e.key === '\\' || e.code === 'Backslash')) return;

      const isAlt = e.altKey;
      const isShift = e.shiftKey;
      const isCmd = e.metaKey || e.ctrlKey;
      const key = e.key.toUpperCase();

      // Don't capture keys if focus is NOT on the file viewer textarea
      // This prevents view mode shortcuts from interfering with chat input, settings, etc.
      const target = e.target as HTMLElement;
      if (target !== textareaRef.current) {
        return;
      }

      // ─── Undo (Ctrl+Z) ───
      if (isCmd && key === 'Z') {
        e.preventDefault();
        if (undoStack.current.length > 0) {
          const textarea = textareaRef.current;
          const cursorPos = textarea?.selectionStart ?? 0;
          const prev = undoStack.current.pop()!;
          setLocalContent(prev);
          if (onChange) {
            isLocalChange.current = true;
            onChange(prev);
          }
          // Restore cursor after React re-renders
          setTimeout(() => {
            if (textarea) {
              const clampedPos = Math.min(cursorPos, prev.length);
              textarea.selectionStart = textarea.selectionEnd = clampedPos;
              textarea.focus();
              updateCursor();
            }
          }, 0);
        }
        return;
      }

      // If it looks like a standard dev tool or system shortcut, don't even look at it
      if (isCmd && (key === 'I' || key === 'R' || key === 'O' || key === 'P' && isShift)) {
        if (key === 'I' || key === 'R') return; 
      }

      if (showSearch) {
        if (e.key === 'Escape' || (isCmd && key === 'G')) {
          e.preventDefault();
          setShowSearch(false);
          textareaRef.current?.focus();
          return;
        }
        if (e.key === 'Enter') {
          nextSearch();
          return;
        }
        return; // Don't process other keys when searching
      }

      if (!isEditing) {
        const isPlainKey = !isCmd && !isAlt && !isShift;

        // Helper to check if a key matches a viewMode binding
        const isViewBinding = (binding: string | undefined) => isPlainKey && key === binding?.toUpperCase();

        // 1. Single character view mode shortcuts (only in view mode)
        if (isViewBinding(keybindings.viewMode.enterEdit)) {
          e.preventDefault(); setIsEditing(true);
        } else if (isViewBinding(keybindings.viewMode.moveDown)) {
          e.preventDefault(); moveCursor('down');
        } else if (isViewBinding(keybindings.viewMode.moveUp)) {
          e.preventDefault(); moveCursor('up');
        } else if (isViewBinding(keybindings.viewMode.moveLeft)) {
          e.preventDefault(); moveCursor('left');
        } else if (isViewBinding(keybindings.viewMode.moveRight)) {
          e.preventDefault(); moveCursor('right');
        } else if (isPlainKey && e.key === keybindings.viewMode.search) {
          e.preventDefault();
          setShowSearch(true);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
      }

      // ─── Content Keys: apply in BOTH view and edit mode ─────────
      const ck = keybindings.contentKeys || {};

      if (isEditing && (e.key === 'Escape' || (isCmd && key === 'G'))) {
        e.preventDefault();
        setIsEditing(false);
      } else if (isCmd && key === ck.endOfLine?.split('+').pop()) { // End of Line
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const pos = textarea.selectionStart;
          const end = localContent.indexOf('\n', pos);
          const newPos = end === -1 ? localContent.length : end;
          textarea.selectionStart = textarea.selectionEnd = newPos;
          textarea.focus();
          updateCursor();
        }
      } else if (isCmd && key === ck.startOfLine?.split('+').pop()) { // Start of Line
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          const pos = textarea.selectionStart;
          const start = localContent.lastIndexOf('\n', pos - 1);
          const newPos = start === -1 ? 0 : start + 1;
          textarea.selectionStart = textarea.selectionEnd = newPos;
          textarea.focus();
          updateCursor();
        }
      } else if (isCmd && key === ck.killLine?.split('+').pop()) { // Kill line
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          undoStack.current.push(localContent);
          const pos = textarea.selectionStart;
          const end = localContent.indexOf('\n', pos);
          const nextLineStart = end === -1 ? localContent.length : end + 1;
          const newContent = localContent.substring(0, pos) + localContent.substring(nextLineStart);
          setLocalContent(newContent);
          if (onChange) {
            isLocalChange.current = true;
            onChange(newContent);
          }
          // Restore cursor to kill position after React re-renders
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = pos;
            textarea.focus();
            updateCursor();
          }, 0);
        }
      } else if (isCmd && key === ck.selectAll?.split('+').pop()) { // Select All
        e.preventDefault();
        textareaRef.current?.select();
        updateCursor();
      } else if (isCmd && key === ck.prevLine?.split('+').pop()) { // Prev Line
        e.preventDefault(); moveCursor('up');
      } else if (isCmd && key === ck.nextLine?.split('+').pop()) { // Next Line
        e.preventDefault(); moveCursor('down');
      } else if (isCmd && key === ck.forwardChar?.split('+').pop()) { // Forward Char
        e.preventDefault(); moveCursor('right');
      } else if (isCmd && key === ck.backwardChar?.split('+').pop()) { // Backward Char
        e.preventDefault(); moveCursor('left');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, keybindings, localContent, showSearch, searchResults, currentSearchIndex, onChange, onSave]);

  const updateCursor = () => {
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      const textToCursor = localContent.substring(0, pos);
      const lines = textToCursor.split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1].length + 1;
      setCursor({ line, col });
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    setScrollPos({ top: scrollTop, left: scrollLeft });
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = scrollTop;
    }
  };

  const wordCount = localContent.trim() ? localContent.trim().split(/\s+/).length : 0;
  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() || 'txt' : 'txt';

  const lineCount = localContent.split('\n').length;
  const lines = Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);

  const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'pdf', 'zip', 'tar', 'gz', 'mp3', 'mp4', 'webm', 'ogg', 'wav'];
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);
  const isTextFile = !binaryExts.includes(ext);

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden relative">
        {!isTextFile ? (
          <div className="flex-1 flex items-center justify-center bg-accent/20">
            {isImage ? (
              <div className="text-center text-muted-foreground">
                 <p className="mb-2">Image Viewer</p>
                 <span className="text-xs">Cannot display binary content natively here yet.</span>
              </div>
            ) : (
               <div className="text-muted-foreground text-sm">Binary file ({ext}) - Cannot display content.</div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden font-mono text-sm relative">
            <div 
              ref={lineNumRef}
              className="w-12 shrink-0 bg-sidebar border-r border-border text-right pr-2 py-4 text-muted-foreground opacity-60 overflow-hidden select-none"
            >
              {lines.map((l) => <div key={l} className="leading-relaxed h-6">{l}</div>)}
            </div>
            <textarea
              ref={textareaRef}
              value={localContent}
              readOnly={false}
              onBeforeInput={(e) => {
                if (!isEditing) e.preventDefault();
              }}
              onScroll={handleScroll}
              onSelect={updateCursor}
              onKeyUp={updateCursor}
              onClick={updateCursor}
              onChange={handleContentChange}
              className={cn(
                "flex-1 resize-none bg-transparent outline-none p-4 leading-relaxed whitespace-pre font-mono text-foreground transition-all",
                isEditing ? "caret-blue-500" : "caret-muted-foreground/60",
                "selection:bg-blue-500/30"
              )}
              style={{ lineHeight: '1.5rem', tabSize: 4 }}
              track-cursor="true"
              wrap="off"
              autoFocus
            />
          </div>
        )}
        
        {showSearch && (
          <div className="absolute top-4 right-4 z-50 bg-sidebar border border-border rounded-md shadow-lg p-2 flex items-center gap-2">
            <input 
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search..."
              className="bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 w-48"
            />
            <span className="text-xs text-muted-foreground mr-2">
              {searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0/0'}
            </span>
            <button onClick={() => setShowSearch(false)} className="text-muted-foreground hover:text-foreground">
              <Eye size={16} />
            </button>
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="h-7 shrink-0 bg-muted/50 border-t border-border text-muted-foreground flex items-center px-4 justify-between text-xs font-sans">
        <div className="flex items-center gap-4">
           <span className="font-medium truncate max-w-[200px]">{filename}</span>
           {isTextFile && (
             <div className="flex items-center gap-2">
               {isDirty && (
                 <button
                   onClick={onSave}
                   className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors mr-2"
                   title="Save File (Cmd/Ctrl + S)"
                 >
                   <Save size={12} />
                   <span>Save</span>
                 </button>
               )}
               <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-accent hover:text-foreground transition-colors"
                  title={isEditing ? "Switch to View Mode" : "Switch to Edit Mode"}
               >
                  {isEditing ? <Pencil size={12} className="text-blue-500" /> : <Eye size={12} />}
                  <span>{isEditing ? 'Editing' : 'Read Only'}</span>
               </button>
             </div>
           )}
        </div>
        <div className="flex gap-4 items-center opacity-80">
           {isTextFile && <span>Ln {cursor.line}, Col {cursor.col}</span>}
           {isTextFile && <span>{wordCount} words</span>}
           <span>UTF-8</span>
           <span className="uppercase">{ext}</span>
        </div>
      </div>
    </div>
  );
}
