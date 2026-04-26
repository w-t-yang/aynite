import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Eye } from 'lucide-react';

interface FileViewerProps {
  filename: string;
  content: string;
  onChange?: (content: string) => void;
}

export default function FileViewer({ filename, content, onChange }: FileViewerProps) {
  const [localContent, setLocalContent] = useState(content);
  const [isEditing, setIsEditing] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  useEffect(() => {
    setIsEditing(false); // reset mode on file change
    if (textareaRef.current) {
      textareaRef.current.scrollTop = 0;
      textareaRef.current.scrollLeft = 0;
    }
  }, [filename]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
    if (onChange) {
      onChange(e.target.value);
    }
    updateCursor();
  };

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
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = e.currentTarget.scrollTop;
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
              readOnly={!isEditing}
              onScroll={handleScroll}
              onSelect={updateCursor}
              onKeyUp={updateCursor}
              onClick={updateCursor}
              onChange={handleContentChange}
              className={`flex-1 resize-none bg-transparent outline-none p-4 leading-relaxed whitespace-pre font-mono text-foreground ${isEditing ? 'cursor-text' : 'cursor-default'}`}
              style={{ lineHeight: '1.5rem', tabSize: 4 }}
              wrap="off"
            />
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="h-7 shrink-0 bg-muted/50 border-t border-border text-muted-foreground flex items-center px-4 justify-between text-xs font-sans">
        <div className="flex items-center gap-4">
           <span className="font-medium truncate max-w-[200px]">{filename}</span>
           {isTextFile && (
             <button 
                onClick={() => setIsEditing(!isEditing)} 
                className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-accent hover:text-foreground transition-colors"
                title={isEditing ? "Switch to View Mode" : "Switch to Edit Mode"}
             >
                {isEditing ? <Pencil size={12} className="text-blue-500" /> : <Eye size={12} />}
                <span>{isEditing ? 'Editing' : 'Read Only'}</span>
             </button>
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
