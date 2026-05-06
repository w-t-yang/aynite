import { Video } from 'lucide-react'
import type React from 'react'
import { type FileInfo, formatFileSize } from '../../lib/file-handlers'
import { VIEWER_CENTERED_COL } from '../../lib/styles'
import { UnifiedViewer } from './UnifiedViewer'

export const VideoViewer: React.FC<{ file: FileInfo }> = ({ file }) => (
  <UnifiedViewer padding="p-8">
    <div className={VIEWER_CENTERED_COL}>
      <video
        controls
        className="max-w-full max-h-[70vh] rounded-lg shadow-2xl border border-white/10"
        src={`aynite-resource://${file.path}`}
      />
      <div className="text-muted-foreground text-sm flex items-center gap-2 bg-sidebar/50 px-4 py-2 rounded-full border border-border/30">
        <Video size={14} /> {file.path.split(/[/\\]/).pop()} (
        {formatFileSize(file.size)})
      </div>
    </div>
  </UnifiedViewer>
)
