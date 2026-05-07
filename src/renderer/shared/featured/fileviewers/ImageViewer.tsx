import type React from 'react'
import { VIEWER_CENTERED_COL } from '../../../../lib/constants/renderer/styles'
import { type FileInfo, formatFileSize } from '../../lib/file-handlers'
import { UnifiedViewer } from './UnifiedViewer'

export const ImageViewer: React.FC<{ file: FileInfo }> = ({ file }) => (
  <UnifiedViewer padding="p-8">
    <div className={VIEWER_CENTERED_COL}>
      <div className="p-2 rounded-lg border border-border/50 shadow-2xl bg-sidebar/30">
        <img
          src={`aynite-resource://${file.path}`}
          alt={file.path}
          className="max-w-full max-h-[70vh] object-contain rounded-md"
        />
      </div>
      <div className="flex flex-col items-center gap-1 text-muted-foreground bg-sidebar/50 px-4 py-2 rounded-full border border-border/30">
        <span className="text-sm font-medium text-foreground">
          {file.path.split(/[/\\]/).pop()}
        </span>
        <span className="text-[10px] uppercase tracking-widest opacity-60">
          {formatFileSize(file.size)} • {file.extension}
        </span>
      </div>
    </div>
  </UnifiedViewer>
)
