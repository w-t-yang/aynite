import { Eye, GitCompare, Pencil, Save } from 'lucide-react'
import type { MatchingView } from '../../../../lib/types/file-browser'
import type { FileInfo } from '../../../../lib/types/files'
import { Tooltip } from '../../../shared/basic/Tooltip'
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
  /** When true, the file has git changes available for diff view */
  hasDiff?: boolean
  /** When true, the diff view is currently shown */
  showDiff?: boolean
  /** Called when user clicks the diff mode button */
  onShowDiff?: () => void
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
  hasDiff = false,
  showDiff = false,
  onShowDiff,
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

  const hasAnyMode = matchedFileviews.length > 0 || hasDiff || isText

  const handleDiff = () => {
    onSelectFileview?.(null)
    onSelectView?.(null)
    setIsEditing(false)
    setIsViewOnly(false)
    onShowDiff?.()
  }

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
        {/* ─── Mode buttons ──────────────────────────── */}
        {hasAnyMode && (
          <div className="flex items-center gap-0.5">
            {/* Dataview preview buttons */}
            {matchingViews.map((view) => (
              <Tooltip key={view.name} content={view.config.description}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectFileview?.(null)
                    onSelectView?.(view.name)
                  }}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wider transition-colors',
                    activeView === view.name
                      ? 'text-foreground/80'
                      : 'text-muted-foreground/40 hover:text-muted-foreground/70',
                  )}
                >
                  {view.config.name}
                </button>
              </Tooltip>
            ))}

            {/* Fileview mode buttons */}
            {matchedFileviews.map((fv) => (
              <Tooltip key={fv.view} content={fv.config.description}>
                <button
                  type="button"
                  onClick={() => onSelectFileview?.(fv.view)}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wider transition-colors',
                    activeFileview === fv.view
                      ? 'text-foreground/80'
                      : 'text-muted-foreground/40 hover:text-muted-foreground/70',
                  )}
                >
                  {fv.config.name}
                </button>
              </Tooltip>
            ))}

            {/* Separator before action modes */}
            {(matchedFileviews.length > 0 || matchingViews.length > 0) &&
              (hasDiff || isText) && (
                <div className="w-px h-3 bg-border/30 mx-0.5" />
              )}

            {/* Diff mode */}
            {hasDiff && (
              <Tooltip content="View git diff">
                <button
                  type="button"
                  onClick={handleDiff}
                  className={cn(
                    'p-1 rounded transition-colors',
                    showDiff
                      ? 'text-foreground/80'
                      : 'text-muted-foreground/40 hover:text-muted-foreground/70',
                  )}
                >
                  <GitCompare size={13} />
                </button>
              </Tooltip>
            )}

            {/* View mode */}
            {isText && (
              <Tooltip content="View file (read-only)">
                <button
                  type="button"
                  onClick={handleView}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isViewOnly &&
                      !isEditing &&
                      !showDiff &&
                      activeFileview === null &&
                      activeView === null
                      ? 'text-foreground/80'
                      : 'text-muted-foreground/40 hover:text-muted-foreground/70',
                  )}
                >
                  <Eye size={13} />
                </button>
              </Tooltip>
            )}

            {/* Edit mode */}
            {isText && !isPdf && (
              <Tooltip content="Edit file">
                <button
                  type="button"
                  onClick={handleEdit}
                  className={cn(
                    'p-1 rounded transition-colors',
                    isEditing
                      ? 'text-foreground/80'
                      : 'text-muted-foreground/40 hover:text-muted-foreground/70',
                  )}
                >
                  <Pencil size={13} />
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* Save button — only shown in edit mode */}
        {isEditing && (
          <Tooltip content="Save (Ctrl+S)">
            <button
              type="button"
              onClick={onSave}
              disabled={!isDirty}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ml-1',
                isDirty
                  ? 'text-primary hover:bg-primary/10 cursor-pointer'
                  : 'text-muted-foreground/20 cursor-default',
              )}
            >
              <Save size={11} />
            </button>
          </Tooltip>
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
