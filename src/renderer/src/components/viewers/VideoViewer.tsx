import React from 'react';
import { Video } from 'lucide-react';
import { UnifiedViewer } from './UnifiedViewer';
import { FileInfo, formatFileSize } from '../../lib/file-handlers';

export const VideoViewer: React.FC<{ file: FileInfo }> = ({ file }) => (
  <UnifiedViewer padding="p-8">
    <div className="flex flex-col items-center justify-center min-h-full gap-8">
      <video controls className="max-w-full max-h-[70vh] rounded-lg shadow-2xl border border-white/10" src={`aynite-resource://${file.path}`} />
      <div className="text-muted-foreground text-sm flex items-center gap-2 bg-sidebar/50 px-4 py-2 rounded-full border border-border/30">
        <Video size={14} /> {file.path.split(/[\/\\]/).pop()} ({formatFileSize(file.size)})
      </div>
    </div>
  </UnifiedViewer>
);
