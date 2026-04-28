import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Eye, Save, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { getFileCategory, FileInfo } from '../lib/file-handlers';
import { FileHandlerComponents } from './viewers';
import Editor from 'react-simple-code-editor';
// @ts-ignore
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-yaml';
import 'prism-themes/themes/prism-vsc-dark-plus.css';

interface FileViewerProps {
  filename: string;
  content: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  isDirty?: boolean;
  keybindings: any;
  initialCursorPos?: number;
  onCursorChange?: (pos: number) => void;
  id: string;
}

export default function FileViewer({ 
  filename, content, onChange, onSave, isDirty, keybindings, initialCursorPos, onCursorChange, id 
}: FileViewerProps) {
  const [localContent, setLocalContent] = useState(content);
  const [isEditing, setIsEditing] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [scrollPos, setScrollPos] = useState({ top: 0, left: 0 });
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const category = fileInfo ? getFileCategory(fileInfo.extension, fileInfo.isText) : 'text';
  const Handler = FileHandlerComponents[category];
  const canEdit = category === 'text' || category === 'markdown' || category === 'html';
  
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
  }, [id]);

  useEffect(() => {
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const path = id.startsWith('file-') ? id.replace('file-', '') : id;
        // @ts-ignore
        const res = await window.api.getFileInfo(path);
        if (res.error) throw new Error(res.error);
        setFileInfo(res.data);
      } catch (e: any) {
        console.error('Failed to fetch file info:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
    setIsEditing(false);
  }, [id]);

  useEffect(() => {
    const el = document.getElementById('file-editor-textarea') as HTMLTextAreaElement;
    if (el) {
      textareaRef.current = el;
      el.focus();
      if (initialCursorPos !== undefined) {
        el.setSelectionRange(initialCursorPos, initialCursorPos);
        setTimeout(() => {
          updateCursor();
          const pos = initialCursorPos;
          const textBefore = el.value.substring(0, pos);
          const lineCount = textBefore.split('\n').length;
          const lineHeight = 24;
          el.scrollTop = Math.max(0, (lineCount - 5) * lineHeight);
        }, 0);
      } else {
        el.scrollTop = 0;
        el.scrollLeft = 0;
        el.setSelectionRange(0, 0);
      }
    }
  }, [id, category]);

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
      jumpToSearchResult(results[0], false); // Don't steal focus while typing
    } else {
      setCurrentSearchIndex(-1);
    }
  };

  const jumpToSearchResult = (pos: number, shouldFocus = true) => {
    if (!textareaRef.current) return;
    if (shouldFocus) textareaRef.current.focus();
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

      if (e.key === 'Tab') {
        if (isEditing && e.target === textareaRef.current) {
          e.preventDefault();
          const textarea = textareaRef.current;
          if (!textarea) return;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const val = textarea.value;
          textarea.value = val.substring(0, start) + "\t" + val.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 1;
          setLocalContent(textarea.value);
          if (onChange) onChange(textarea.value);
          updateCursor();
        } else {
          e.preventDefault();
        }
        return;
      }

      // Don't capture keys if focus is NOT on the file viewer textarea or search input
      const target = e.target as HTMLElement;
      const editorTextarea = document.getElementById('file-editor-textarea');
      if (target !== editorTextarea && target !== textareaRef.current && target !== searchInputRef.current) {
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
          e.preventDefault();
          nextSearch();
          return;
        }
        // If we're in the search input, don't let other keys through to the editor
        if (target === searchInputRef.current) return;
      }

      // Prevent any deletion in view mode
      if (!isEditing) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          return;
        }
      }

      if (!isEditing) {
        const isPlainKey = !isCmd && !isAlt && !isShift;

        // Helper to check if a key matches a viewer binding
        const isViewBinding = (binding: string | undefined) => isPlainKey && key === binding?.toUpperCase();

        // 1. Single character viewer shortcuts (only in view mode)
        const v = keybindings.content.viewer;
        if (isViewBinding(v.enterEdit)) {
          e.preventDefault(); setIsEditing(true);
        } else if (isViewBinding(v.moveDown)) {
          e.preventDefault(); moveCursor('down');
        } else if (isViewBinding(v.moveUp)) {
          e.preventDefault(); moveCursor('up');
        } else if (isViewBinding(v.moveLeft)) {
          e.preventDefault(); moveCursor('left');
        } else if (isViewBinding(v.moveRight)) {
          e.preventDefault(); moveCursor('right');
        } else if (isPlainKey && e.key === v.search) {
          e.preventDefault();
          setShowSearch(true);
          setTimeout(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
              searchInputRef.current.select();
            }
          }, 50);
        }
      }

      // ─── Content Generic Keys: apply in BOTH view and edit mode ─────────
      const g = keybindings.content.generic || {};

      if (isEditing && (e.key === 'Escape' || (isCmd && key === 'G'))) {
        e.preventDefault();
        setIsEditing(false);
      } else if (isCmd && key === g.endOfLine?.split('+').pop()) { // End of Line
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
      } else if (isCmd && key === g.startOfLine?.split('+').pop()) { // Start of Line
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
      } else if (isCmd && key === g.killLine?.split('+').pop()) { // Kill line
        if (!isEditing) return;
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
      } else if (isCmd && key === g.deleteForward?.split('+').pop()) { // Delete character (forward)
        if (!isEditing) return;
        e.preventDefault();
        const textarea = textareaRef.current;
        if (textarea) {
          undoStack.current.push(localContent);
          const pos = textarea.selectionStart;
          if (pos < localContent.length) {
            const newContent = localContent.substring(0, pos) + localContent.substring(pos + 1);
            setLocalContent(newContent);
            if (onChange) {
              isLocalChange.current = true;
              onChange(newContent);
            }
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = pos;
              textarea.focus();
              updateCursor();
            }, 0);
          }
        }
      } else if (isCmd && key === g.cut?.split('+').pop()) { // Cut
        if (!isEditing) return;
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
          e.preventDefault();
          undoStack.current.push(localContent);
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const selectedText = localContent.substring(start, end);
          navigator.clipboard.writeText(selectedText);
          const newContent = localContent.substring(0, start) + localContent.substring(end);
          setLocalContent(newContent);
          if (onChange) {
            isLocalChange.current = true;
            onChange(newContent);
          }
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start;
            textarea.focus();
            updateCursor();
          }, 0);
        }
      } else if (isCmd && key === g.copy?.split('+').pop()) { // Copy
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
          e.preventDefault();
          const selectedText = localContent.substring(textarea.selectionStart, textarea.selectionEnd);
          navigator.clipboard.writeText(selectedText);
        }
      } else if (isCmd && key === g.paste?.split('+').pop()) { // Paste
        if (!isEditing) return;
        const textarea = textareaRef.current;
        if (textarea) {
          e.preventDefault();
          navigator.clipboard.readText().then(text => {
            undoStack.current.push(localContent);
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newContent = localContent.substring(0, start) + text + localContent.substring(end);
            setLocalContent(newContent);
            if (onChange) {
              isLocalChange.current = true;
              onChange(newContent);
            }
            setTimeout(() => {
              textarea.selectionStart = textarea.selectionEnd = start + text.length;
              textarea.focus();
              updateCursor();
            }, 0);
          });
        }
      } else if (isCmd && key === g.selectAll?.split('+').pop()) { // Select All
        e.preventDefault();
        textareaRef.current?.select();
        updateCursor();
      } else if (isCmd && key === g.prevLine?.split('+').pop()) { // Prev Line
        e.preventDefault(); moveCursor('up');
      } else if (isCmd && key === g.nextLine?.split('+').pop()) { // Next Line
        e.preventDefault(); moveCursor('down');
      } else if (isCmd && key === g.forwardChar?.split('+').pop()) { // Forward Char
        e.preventDefault(); moveCursor('right');
      } else if (isCmd && key === g.backwardChar?.split('+').pop()) { // Backward Char
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
      if (onCursorChange) onCursorChange(pos);
    }
  };


  useEffect(() => {
    // Keep textareaRef in sync with the Editor's internal textarea
    const el = document.getElementById('file-editor-textarea') as HTMLTextAreaElement;
    if (el) {
      textareaRef.current = el;
      // Force caret visibility - important since react-simple-code-editor makes text transparent
      el.style.caretColor = isEditing ? 'var(--primary)' : '#808080'; // Primary if editing, grey in view mode
      el.style.opacity = '1';
    }
  });

  // Focus the editor when category or isEditing changes
  useEffect(() => {
    if (canEdit) {
      setTimeout(() => {
        const el = document.getElementById('file-editor-textarea');
        if (el) el.focus();
      }, 100);
    }
  }, [category, isEditing]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    setScrollPos({ top: scrollTop, left: scrollLeft });
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = scrollTop;
    }
  };

  const wordCount = localContent.trim() ? localContent.trim().split(/\s+/).length : 0;

  const lineCount = localContent.split('\n').length;
  const lines = Array.from({ length: Math.max(1, lineCount) }, (_, i) => i + 1);

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-destructive gap-2">
            <AlertCircle size={32} />
            <p>Error loading file info: {error}</p>
          </div>
        ) : (isEditing && canEdit) || (category === 'text') ? (
          <div className="flex-1 flex overflow-hidden font-mono text-sm relative bg-background">
            <div 
              ref={lineNumRef}
              className="w-12 shrink-0 bg-sidebar border-r border-border text-right pr-2 py-4 text-muted-foreground opacity-60 overflow-hidden select-none z-10"
            >
              {lines.map((l) => <div key={l} className="leading-relaxed h-6">{l}</div>)}
            </div>
            <div className="flex-1 overflow-auto relative" onScroll={(e) => {
               if (lineNumRef.current) lineNumRef.current.scrollTop = e.currentTarget.scrollTop;
            }}>
              <Editor
                value={localContent}
                onValueChange={content => {
                  if (!isEditing) return;
                  setLocalContent(content);
                  if (onChange) {
                    isLocalChange.current = true;
                    onChange(content);
                  }
                }}
                highlight={code => {
                  const langMap: any = {
                    'js': languages.js,
                    'ts': languages.typescript,
                    'tsx': languages.typescript,
                    'jsx': languages.js,
                    'json': languages.json,
                    'css': languages.css,
                    'html': languages.html,
                    'py': languages.python,
                    'rs': languages.rust,
                    'sh': languages.bash,
                    'bash': languages.bash,
                    'yaml': languages.yaml,
                    'yml': languages.yaml,
                    'md': languages.markdown
                  };
                  const lang = langMap[fileInfo?.extension || ''] || languages.clike || languages.plain;
                  return highlight(code, lang, fileInfo?.extension || 'text');
                }}
                padding={16}
                className="min-h-full font-mono text-sm leading-relaxed outline-none"
                style={{
                  fontFamily: '"Fira Code", monospace',
                  minHeight: '100%',
                }}
                readOnly={!isEditing}
                textareaId="file-editor-textarea"
                textareaClassName="outline-none focus:ring-0 !caret-primary"
                preClassName="selection:bg-primary/30"
                // @ts-ignore
                textareaProps={{ 
                  "track-cursor": "true",
                  spellCheck: false,
                  autoCapitalize: "off",
                  autoComplete: "off",
                  autoCorrect: "off",
                  style: { caretColor: isEditing ? 'var(--primary)' : '#808080' }
                }}
              />
            </div>
          </div>
        ) : (
          <Handler file={fileInfo!} content={localContent} />
        )}
        
        {showSearch && (
          <div className="absolute top-4 right-4 z-50 bg-sidebar border border-border rounded-md shadow-lg p-2 flex items-center gap-2">
            <input 
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search..."
              className="bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-primary w-48"
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
           {!loading && !error && canEdit && (
             <div className="flex items-center gap-2">
               {isDirty && (
                 <button
                   onClick={onSave}
                   className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors mr-2"
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
                  {isEditing ? <Pencil size={12} className="text-primary" /> : <Eye size={12} />}
                  <span>{isEditing ? 'Editing' : (category === 'markdown' ? 'Preview' : 'View Mode')}</span>
               </button>
             </div>
           )}
        </div>
        <div className="flex gap-4 items-center opacity-80">
           {canEdit && isEditing && <span>Ln {cursor.line}, Col {cursor.col}</span>}
           {canEdit && <span>{wordCount} words</span>}
           <span>UTF-8</span>
           <span className="uppercase">{fileInfo?.extension || 'txt'}</span>
        </div>
      </div>
    </div>
  );
}
