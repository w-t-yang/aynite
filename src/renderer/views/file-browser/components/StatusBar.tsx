import { Eye, Pencil, Save } from 'lucide-react'
import type { MatchingView } from '../../../../lib/types/file-browser'
import type { FileInfo } from '../../../../lib/types/files'
import { cn } from '../../../shared/lib/utils'

export interface FileviewConfig {
  name: string
  description: string
  author: string
  version: string
  file_extensions: string[]
  key_bindings: Record<string, unknown>
}

interface StatusBarProps {
  isEditing: boolean
  setIsEditing: (val: boolean) => void
  /** When true, shows a read-only text editor instead of fileview */
  isViewOnly: boolean
  setIsViewOnly: (val: boolean) => void
  fileInfo: FileInfo | null
  content: string | null
  onSave?: () => void
  isDirty?: boolean
  /** Whether the file is text-based (determines if edit mode is available) */
  isText?: boolean
  /** Views whose schema matches the current file */
  matchingViews?: MatchingView[]
  /** Currently selected view preview mode (null = default) */
  activeView?: string | null
  /** Called when user selects a view or default */
  onSelectView?: (viewName: string | null) => void
  /** Fileview configs that match the current file's extension */
  matchedFileviews?: Array<{ view: string; config: FileviewConfig }>
  /** Currently active fileview directory name (null = none) */
  activeFileview?: string | null
  /** Called when user selects a fileview */
  onSelectFileview?: (view: string | null) => void
}

export function StatusBar({
  isEditing,
  setIsEditing,
  isViewOnly,
  setIsViewOnly,
  fileInfo,
  content,
  onSave,
  isDirty = false,
  isText = false,
  matchingViews = [],
  activeView = null,
  onSelectView,
  matchedFileviews = [],
  activeFileview = null,
  onSelectFileview,
}: StatusBarProps) {
  const wordCount = content ? content.trim().split(/\s+/).length : 0
  const lineCount = content ? content.split('\n').length : 0
  const isPdf = fileInfo?.extension?.toLowerCase() === 'pdf'

  const handleView = () => {
    onSelectFileview?.(null)
    onSelectView?.(null)
    setIsViewOnly(true)
    setIsEditing(false)
  }

  const handleEdit = () => {
    onSelectFileview?.(null)
    onSelectView?.(null)
    setIsEditing(true)
    setIsViewOnly(false)
  }

  return (
    <div className="h-[26px] shrink-0 bg-sidebar border-t border-border flex items-center px-3 text-[11px] text-muted-foreground/70 select-none">
      {/* Left section: mode + save */}
      <div className="flex items-center gap-1">
        <div className="flex items-center text-[10px] font-medium tracking-wider">
          {/* Matching view preview buttons (dataviews) */}
          {matchingViews.map((view, i) => (
            <button
              key={view.name}
              type="button"
              onClick={() => {
                onSelectFileview?.(null)
                onSelectView?.(view.name)
              }}
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

          {/* Fileview mode buttons (e.g. Markdown, HTML, Image, Audio, PDF, Video) */}
          {matchedFileviews.map((fv, i) => (
            <button
              key={fv.view}
              type="button"
              onClick={() => {
                onSelectFileview?.(fv.view)
                // Don't call onSelectView — it would reset activeFileview
              }}
              title={fv.config.description}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 transition-colors',
                activeFileview === fv.view
                  ? 'text-foreground/80'
                  : 'text-muted-foreground/40 hover:text-muted-foreground/70',
              )}
            >
              {i > 0 && <div className="w-px h-3 bg-border/30 mr-1" />}
              <span>{fv.config.name}</span>
            </button>
          ))}

          {matchedFileviews.length > 0 && isText && (
            <div className="w-px h-3 bg-border/30" />
          )}

          {/* View mode (read-only text editor) — only for text files */}
          {isText && (
            <button
              type="button"
              onClick={handleView}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 transition-colors',
                isViewOnly &&
                  !isEditing &&
                  activeFileview === null &&
                  activeView === null
                  ? 'text-foreground/80'
                  : 'text-muted-foreground/40 hover:text-muted-foreground/70',
              )}
            >
              <Eye size={11} />
              <span>View</span>
            </button>
          )}

          {/* Edit mode — only for text files */}
          {isText && !isPdf && (
            <button
              type="button"
              onClick={handleEdit}
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
          )}
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
        {!isPdf && (
          <>
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
          </>
        )}

        <span className="px-2 py-0.5 bg-muted/40 rounded text-[10px] font-medium text-foreground/70">
          {fileInfo?.extension?.toUpperCase() || 'TXT'}
        </span>
      </div>
    </div>
  )
}
