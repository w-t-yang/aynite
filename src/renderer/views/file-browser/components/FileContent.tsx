import { Plus } from 'lucide-react'
import { AppOperation } from '../../../../lib/constants/app'
import { fileviewComponents } from '../../../../lib/constants/fileview-components'
import type { FileInfo } from '../../../../lib/types/files'
import { Button } from '../../../shared/basic/Button'
import { DiffViewer } from '../../../shared/featured/fileviewers/DiffViewer'
import { TextEditor } from '../../../shared/featured/fileviewers/TextEditor'
import { UnsupportedViewer } from '../../../shared/featured/fileviewers/UnsupportedViewer'
import { useAppOperation } from '../../ViewContext'
import { ViewPreview } from './ViewPreview'

interface FileContentProps {
  path: string | null
  content: string | null
  fileInfo: FileInfo | null
  loading: boolean
  error: string | null
  isEditing?: boolean
  /** When true, shows a read-only TextEditor (same appearance as edit) */
  isViewOnly?: boolean
  onContentChange?: (content: string) => void
  /** Active view preview mode (null = default rendering) */
  activeView?: string | null
  /** Active fileview directory name (e.g. 'fileview-markdown'), null = no fileview mode */
  activeFileview?: string | null
  /** When true, shows the git diff view for the file */
  showDiff?: boolean
  /** Git head/index content for the diff view */
  diffHeadContent?: string | null
  /** Git current/working content for the diff view */
  diffCurrentContent?: string | null
  /** Whether the file is text-based (determines if edit mode is available) */
  isText?: boolean
  /** Search query for highlighting matches */
  searchQuery?: string
  /** Index of the active (current) search match */
  activeMatchIndex?: number
  /** Called with total match count */
  onSearchResult?: (total: number) => void
  /** i18n translate function */
  t?: (key: string) => string
}

export function FileContent({
  path,
  content,
  fileInfo,
  loading,
  error,
  isEditing = false,
  _isViewOnly = false,
  onContentChange,
  activeView = null,
  activeFileview = null,
  showDiff = false,
  diffHeadContent = null,
  diffCurrentContent = null,
  isText = false,
  searchQuery,
  activeMatchIndex,
  onSearchResult,
  t: tProp,
}: FileContentProps) {
  const t = tProp || ((key: string) => key)
  const execOp = useAppOperation()

  if (!path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground select-none">
        <div className="text-4xl font-bold mb-2 opacity-20">
          {t('empty.title')}
        </div>
        <div className="text-xs tracking-widest uppercase opacity-20 mb-8">
          {t('empty.subtitle')}
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={() => execOp(AppOperation.SWITCH_FILE)}
          className="gap-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
        >
          <Plus size={16} />
          <span>{t('empty.selectFile')}</span>
          <span className="ml-2 text-[10px] opacity-40 px-1.5 py-0.5 rounded border border-border bg-muted/50">
            Ctrl+Tab
          </span>
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive p-8 text-center">
        <div>
          <div className="text-lg font-bold mb-2">{t('error.title')}</div>
          <div className="text-sm opacity-80">{error}</div>
        </div>
      </div>
    )
  }

  if (!fileInfo) return null

  // Render view preview if a matching dataview is active
  if (activeView && path) {
    return <ViewPreview viewName={activeView} filePath={path} />
  }

  // ─── Mode-based rendering ──────────────────────────────────────────
  // Priority: Fileview > Diff > Edit > View > Unsupported

  // 1. Fileview mode
  if (activeFileview && fileviewComponents[activeFileview]) {
    const FileViewComponent = fileviewComponents[activeFileview]
    return <FileViewComponent file={fileInfo} content={content ?? undefined} />
  }

  // 2. Diff mode
  if (showDiff && diffHeadContent && path) {
    return (
      <DiffViewer
        headContent={diffHeadContent}
        currentContent={diffCurrentContent ?? content ?? ''}
        extension={fileInfo.extension}
        filePath={path}
        className="flex-1"
      />
    )
  }

  // 3. Edit mode (only for text files)
  if (isEditing && isText) {
    return (
      <TextEditor
        content={content || ''}
        onChange={onContentChange || (() => {})}
        file={fileInfo}
        className="flex-1"
        searchQuery={searchQuery}
        activeMatchIndex={activeMatchIndex}
        onSearchResult={onSearchResult}
      />
    )
  }

  // 4. Non-text file with no matching fileview → unsupported
  if (!isText && !activeFileview) {
    return <UnsupportedViewer file={fileInfo} reason="binary" />
  }

  // 5. View mode (read-only TextEditor)
  return (
    <TextEditor
      content={content || ''}
      onChange={() => {}}
      file={fileInfo}
      className="flex-1"
      readOnly
      searchQuery={searchQuery}
      activeMatchIndex={activeMatchIndex}
      onSearchResult={onSearchResult}
    />
  )
}
