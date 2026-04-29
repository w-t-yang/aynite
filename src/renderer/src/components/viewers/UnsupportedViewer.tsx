import React from 'react';
import { Info } from 'lucide-react';
import { UnifiedViewer } from './UnifiedViewer';
import { FileInfo, formatFileSize } from '../../lib/file-handlers';

export const UnsupportedViewer: React.FC<{ file: FileInfo, reason?: 'too_large' | 'binary' | 'other' }> = ({ file, reason }) => (
  <UnifiedViewer padding="p-8">
    <div className="flex items-center justify-center min-h-full">
      <div className="max-w-md w-full bg-sidebar border border-border p-8 rounded-2xl shadow-xl flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center">
          <Info size={32} className="text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {reason === 'too_large' ? 'File Too Large' : 'Unsupported File Type'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {reason === 'too_large' 
              ? `Aynite cannot open text files larger than 10MB in the built-in editor.` 
              : "Aynite doesn't support direct preview for this file type yet."}
          </p>
          <div className="w-full grid grid-cols-2 gap-4 text-left">
            <div className="bg-background/50 p-3 rounded-lg border border-border/50">
               <span className="text-[10px] uppercase text-muted-foreground block mb-1">File Size</span>
               <span className="text-sm font-medium">{formatFileSize(file.size)}</span>
            </div>
            <div className="bg-background/50 p-3 rounded-lg border border-border/50">
               <span className="text-[10px] uppercase text-muted-foreground block mb-1">Extension</span>
               <span className="text-sm font-medium uppercase">{file.extension || 'none'}</span>
            </div>
            <div className="bg-background/50 p-3 rounded-lg border border-border/50 col-span-2">
               <span className="text-[10px] uppercase text-muted-foreground block mb-1">Modified At</span>
               <span className="text-sm font-medium">{new Date(file.modifiedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UnifiedViewer>
);
