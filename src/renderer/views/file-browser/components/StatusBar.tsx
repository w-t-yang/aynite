import { Eye, Pencil, Save } from 'lucide-react'
import type { FileInfo } from '../../../../lib/types/files'
import { cn } from '../../../shared/lib/utils'

export interface MatchingView {
  name: string
  config: {
    name: string
    description?: string
  }
}

interface StatusBarProps {
  isEditing: boolean
  setIsEditing: (val: boolean) => void
  fileInfo: FileInfo | null
  content: string | null
  onSave?: () => void
  isDirty?: boolean
  /** Views whose schema matches the current file */
  matchingViews?: MatchingView[]
  /** Currently selected view preview mode (null = default) */
  activeView?: string | null
  /** Called when user selects a view or default */
  onSelectView?: (viewName: string | null) => void
}

export function StatusBar({
  isEditing,
  setIsEditing,
  fileInfo,
  content,
  onSave,
  isDirty = false,
  matchingViews = [],
  activeView = null,
  onSelectView,
}: StatusBarProps) {
  const wordCount = content ? content.trim().split(/\s+/).length : 0
  const lineCount = content ? content.split('\n').length : 0

  return (
    <div className="h-[26px] shrink-0 bg-sidebar border-t border-border flex items-center px-3 text-[11px] text-muted-foreground/70 select-none">
      {/* Left section: mode + save */}
      <div className="flex items-center gap-1">
        <div className="flex items-center text-[10px] font-medium tracking-wider">
          {/* Matching view buttons */}
          {matchingViews.map((view, i) => (
            <button
              key={view.name}
              type="button"
              onClick={() => onSelectView?.(view.name)}
              title={view.config.description}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 transition-colors',
                activeView === view.name
                  ? 'text-foreground/80'
                  : 'text-muted-foreground/40 hover:text-muted-foreground/70',
              )}
            >
              {i > 0 && <div className="w-px h-3 bg-border/30 mr-1" />}
              <span>{view.config.name}</span>
            </button>
          ))}

          {matchingViews.length > 0 && (
            <div className="w-px h-3 bg-border/30" />
          )}

          {/* View mode (text viewer) */}
          <button
            type="button"
            onClick={() => {
              setIsEditing(false)
              onSelectView?.(null)
            }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 transition-colors',
              !isEditing && activeView === null
                ? 'text-foreground/80'
                : 'text-muted-foreground/40 hover:text-muted-foreground/70',
            )}
          >
            <Eye size={11} />
            <span>View</span>
          </button>

          {/* Edit mode */}
          <button
            type="button"
            onClick={() => {
              setIsEditing(true)
              onSelectView?.(null)
            }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 transition-colors',
              isEditing
                ? 'text-foreground/80'
                : 'text-muted-foreground/40 hover:text-muted-foreground/70',
            )}
          >
            <Pencil size={11} />
            <span>Edit</span>
          </button>
        </div>

        {isEditing && (
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ml-1',
              isDirty
                ? 'text-primary hover:bg-primary/10 cursor-pointer'
                : 'text-muted-foreground/20 cursor-default',
            )}
          >
            <Save size={11} />
            <span>Save</span>
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section: metadata */}
      <div className="flex items-center gap-1">
        <span className="px-2 py-0.5 text-muted-foreground/50">
          Ln {lineCount}
        </span>

        <div className="w-px h-3 bg-border/30" />

        <span className="px-2 py-0.5 text-muted-foreground/50">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>

        <div className="w-px h-3 bg-border/30" />

        <span className="px-2 py-0.5">UTF-8</span>

        <div className="w-px h-3 bg-border/30" />

        <span className="px-2 py-0.5">LF</span>

        <div className="w-px h-3 bg-border/30" />

        <span className="px-2 py-0.5 bg-muted/40 rounded text-[10px] font-medium text-foreground/70">
          {fileInfo?.extension?.toUpperCase() || 'TXT'}
        </span>
      </div>
    </div>
  )
}
