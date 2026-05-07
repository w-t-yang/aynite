import { Music } from 'lucide-react'
import type React from 'react'
import { VIEWER_CENTERED_ROW } from '../../../../lib/constants/renderer/styles'
import { type FileInfo, formatFileSize } from '../../lib/file-handlers'
import { UnifiedViewer } from './UnifiedViewer'

export const AudioViewer: React.FC<{ file: FileInfo }> = ({ file }) => (
  <UnifiedViewer padding="p-8">
    <div className={VIEWER_CENTERED_ROW}>
      <div className="bg-sidebar border border-border p-8 rounded-2xl shadow-xl flex flex-col items-center gap-6 w-96">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
          <Music size={32} className="text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-medium text-foreground mb-1 truncate w-64">
            {file.path.split(/[/\\]/).pop()}
          </h3>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {file.extension} • {formatFileSize(file.size)}
          </p>
        </div>
        {/* biome-ignore lint/a11y/useMediaCaption: generic file viewer */}
        <audio
          controls
          className="w-full"
          src={`aynite-resource://${file.path}`}
        />
      </div>
    </div>
  </UnifiedViewer>
)
