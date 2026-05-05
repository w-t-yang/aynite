import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Eye, Save, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getFileCategory, FileInfo } from '../../lib/file-handlers';
import { KeyManager } from '../../lib/key-handlers';
import { FileHandlerComponents } from './index';
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
  onRefresh?: (content: string) => void;
  id: string;
}

function FileViewer({ 
  filename, content, onChange, onSave, isDirty, keybindings, initialCursorPos, onCursorChange, onRefresh, id 
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
  const [externalChangeDetected, setExternalChangeDetected] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
  const lastLocalWriteTime = useRef(0);
  
  // @ts-ignore
  const category = fileInfo ? getFileCategory(fileInfo.extension, fileInfo.isText, fileInfo.path) : 'text';
  const MAX_TEXT_SIZE = 10 * 1024 * 1024;
  const isTextLike = category === 'text' || category === 'markdown' || category === 'html';
  const isTooLarge = isTextLike && (fileInfo?.size || 0) > MAX_TEXT_SIZE;
  const effectiveCategory = isTooLarge ? 'unsupported' : category;
  
  useEffect(() => {
    if (fileInfo) {
      console.log('[FileViewer] File Analysis:', { 
        path: fileInfo.path, 
        extension: fileInfo.extension, 
        isText: fileInfo.isText,
        category, 
        isTooLarge, 
        effectiveCategory 
      });
    }
  }, [fileInfo?.path, effectiveCategory]);
  
  const Handler = FileHandlerComponents[effectiveCategory];
  const canEdit = !isTooLarge && (category === 'text' || category === 'markdown' || category === 'html');
  
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
        const res = await window.aynite.getFileInfo(path);
        setFileInfo({
          ...res,
          createdAt: new Date(res.createdAt),
          modifiedAt: new Date(res.modifiedAt)
        });
      } catch (e: any) {
        console.error('Failed to fetch file info:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
    setIsEditing(false);
    setExternalChangeDetected(false);
    // Force focus to show cursor in View Mode
    setTimeout(() => {
      const el = document.getElementById('file-editor-textarea');
      if (el) el.focus();
    }, 150);
  }, [id]);

  useEffect(() => {
    const handleSaving = (e: any) => {
      const path = e.detail;
      const currentPath = id.startsWith('file-') ? id.replace('file-', '') : id;
      // Normalize both paths for comparison
      if (path.replace(/\\/g, '/') === currentPath.replace(/\\/g, '/')) {
        lastLocalWriteTime.current = Date.now();
      }
    };
    window.addEventListener('file-saving', handleSaving);
    return () => window.removeEventListener('file-saving', handleSaving);
  }, [id]);

  useEffect(() => {
    // Listen for file system changes
    // @ts-ignore
    const cleanup = window.aynite.onFileSystemChange((data) => {
      const currentPath = id.startsWith('file-') ? id.replace('file-', '') : id;
      // We normalize paths to be safe (Chokidar might use different slashes)
      const normalizedChangedPath = data.path.replace(/\\/g, '/');
      const normalizedCurrentPath = currentPath.replace(/\\/g, '/');

      if (normalizedChangedPath === normalizedCurrentPath && (data.event === 'change' || data.event === 'unlink')) {
        // If we just saved the file, ignore the change event
        // This is a simple debouncing/flag mechanism
        const now = Date.now();
        if (now - lastLocalWriteTime.current < 2000) {
          console.log('[FileViewer] Ignoring change event likely triggered by local save');
          return;
        }

        if (!isLocalChange.current) {
          console.log('[FileViewer] External change detected:', data.path);
          setExternalChangeDetected(true);
        }
      }
    });

    return cleanup;
  }, [id]);

  const handleRefresh = async () => {
    if (isDirty && !showRefreshConfirm) {
      setShowRefreshConfirm(true);
      setTimeout(() => setShowRefreshConfirm(false), 3000);
      return;
    }
    
    setShowRefreshConfirm(false);

    setLoading(true);
    try {
      const path = id.startsWith('file-') ? id.replace('file-', '') : id;
      // @ts-ignore
      const res = await window.aynite.readFile(path);
      
      setLocalContent(res);
      if (onRefresh) {
        onRefresh(res);
      } else if (onChange) {
        onChange(res);
      }
      setExternalChangeDetected(false);
      // Also update file info to get latest metadata
      // @ts-ignore
      const infoRes = await window.aynite.getFileInfo(path);
      setFileInfo({
        ...infoRes,
        createdAt: new Date(infoRes.createdAt),
        modifiedAt: new Date(infoRes.modifiedAt)
      });
    } catch (e: any) {
      console.error('Failed to refresh file:', e);
      setError(`Failed to refresh: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

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
      lastLocalWriteTime.current = Date.now();
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

  const jumpToSearchResult = (pos: number, shouldFocus = true, forceEdit = false) => {
    // Only switch to edit mode if explicitly requested (e.g., navigating to a result)
    if (forceEdit && !isEditing && (category === 'markdown' || category === 'html' || category === 'pdf')) {
      setIsEditing(true);
    }

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
      jumpToSearchResult(searchResults[nextIdx], true, true);
    }
  };

  // Register with KeyManager
  useEffect(() => {
    const api = {
      isEditing: () => isEditing,
      isSearchActive: () => showSearch,
      isSearchInputFocused: (target: EventTarget | null) => target === searchInputRef.current,
      getCategory: () => category,
      setIsEditing,
      setSearchActive: (val: boolean) => {
        setShowSearch(val);
        if (val) {
          setTimeout(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
              searchInputRef.current.select();
            }
          }, 50);
        } else {
          textareaRef.current?.focus();
        }
      },
      nextSearch,
      moveCursor,
      endOfLine: () => {
        const textarea = textareaRef.current;
        if (textarea) {
          const pos = textarea.selectionStart;
          const end = localContent.indexOf('\n', pos);
          textarea.selectionStart = textarea.selectionEnd = end === -1 ? localContent.length : end;
          textarea.focus();
          updateCursor();
        }
      },
      startOfLine: () => {
        const textarea = textareaRef.current;
        if (textarea) {
          const pos = textarea.selectionStart;
          const start = localContent.lastIndexOf('\n', pos - 1);
          textarea.selectionStart = textarea.selectionEnd = start === -1 ? 0 : start + 1;
          textarea.focus();
          updateCursor();
        }
      },
      killLine: () => {
        const textarea = textareaRef.current;
        if (textarea) {
          undoStack.current.push(localContent);
          const pos = textarea.selectionStart;
          const end = localContent.indexOf('\n', pos);
          const nextLineStart = end === -1 ? localContent.length : end + 1;
          const newContent = localContent.substring(0, pos) + localContent.substring(nextLineStart);
          setLocalContent(newContent);
          if (onChange) { isLocalChange.current = true; onChange(newContent); }
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = pos; textarea.focus(); updateCursor(); }, 0);
        }
      },
      deleteForward: () => {
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          if (start === end) {
            if (start < localContent.length) {
              undoStack.current.push(localContent);
              const newContent = localContent.substring(0, start) + localContent.substring(start + 1);
              setLocalContent(newContent);
              if (onChange) { isLocalChange.current = true; onChange(newContent); }
              setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start; textarea.focus(); updateCursor(); }, 0);
            }
          } else {
            undoStack.current.push(localContent);
            const newContent = localContent.substring(0, start) + localContent.substring(end);
            setLocalContent(newContent);
            if (onChange) { isLocalChange.current = true; onChange(newContent); }
            setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start; textarea.focus(); updateCursor(); }, 0);
          }
        }
      },
      selectAll: () => {
        textareaRef.current?.select();
        updateCursor();
      },
      refresh: handleRefresh,
    };
    
    KeyManager.registerEditor(id, api);
    
    return () => {
      KeyManager.unregisterEditor(id);
    };
  }, [id, isEditing, showSearch, category, localContent, onChange, onRefresh]);

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
      el.style.caretColor = isEditing ? 'var(--primary)' : '#808080';
      el.style.opacity = '1';
      el.setAttribute('track-cursor', 'true');
      el.spellcheck = false;
      el.setAttribute('autocapitalize', 'off');
      el.setAttribute('autocomplete', 'off');
      el.setAttribute('autocorrect', 'off');
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
        ) : (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Standard Editor - Hidden but active for search/state when viewer is shown */}
            <div className={cn(
              "flex-1 flex overflow-hidden font-mono text-sm relative bg-background",
              (!isEditing && (effectiveCategory === 'markdown' || effectiveCategory === 'html' || effectiveCategory === 'pdf' || effectiveCategory === 'image' || effectiveCategory === 'video' || effectiveCategory === 'audio' || effectiveCategory === 'unsupported')) && "hidden"
            )}>
              {/* External Change Banner */}
              {externalChangeDetected && (
                <div className="absolute top-0 left-0 right-0 z-50 bg-primary/10 border-b border-primary/20 backdrop-blur-sm flex items-center justify-between px-4 py-2 text-xs text-primary animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>This file has been modified externally.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {showRefreshConfirm && <span className="text-[10px] font-bold uppercase tracking-tighter mr-1 animate-pulse">Discard changes?</span>}
                    <button 
                      onClick={handleRefresh}
                      className={cn(
                        "px-3 py-1 rounded-sm transition-all font-medium",
                        showRefreshConfirm ? "bg-destructive text-destructive-foreground shadow-lg scale-105" : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {showRefreshConfirm ? 'Confirm Refresh' : 'Refresh'}
                    </button>
                  </div>
                </div>
              )}

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
                      lastLocalWriteTime.current = Date.now();
                      onChange(content);
                    }
                  }}
                  highlight={code => {
                    const langMap: any = {
                      'js': languages.js, 'ts': languages.typescript, 'tsx': languages.typescript,
                      'jsx': languages.js, 'json': languages.json, 'css': languages.css,
                      'html': languages.html, 'py': languages.python, 'rs': languages.rust,
                      'sh': languages.bash, 'bash': languages.bash, 'yaml': languages.yaml,
                      'yml': languages.yaml, 'md': languages.markdown
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
                />
              </div>
            </div>

            {/* Specialized Viewer */}
            {(!isEditing && (effectiveCategory === 'markdown' || effectiveCategory === 'html' || effectiveCategory === 'pdf' || effectiveCategory === 'image' || effectiveCategory === 'video' || effectiveCategory === 'audio' || effectiveCategory === 'unsupported')) && (
              <div className="absolute inset-0 z-1 bg-background">
                <Handler 
                  file={fileInfo!} 
                  content={localContent} 
                  reason={isTooLarge ? 'too_large' : (effectiveCategory === 'unsupported' ? 'binary' : undefined)} 
                />
              </div>
            )}
          </div>
        )}
        
        {showSearch && (
          <div className="file-viewer-search absolute top-4 right-4 z-50 bg-sidebar border border-border rounded-md shadow-lg p-2 flex items-center gap-2">
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
                  <span>{isEditing ? 'Edit' : 'View'}</span>
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

export default React.memo(FileViewer);
