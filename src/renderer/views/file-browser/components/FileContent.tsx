import { Plus } from 'lucide-react'
import { AppOperation } from '../../../../lib/constants/app'
import { FileHandlerComponents } from '../../../../lib/constants/renderer/ui'
import type { FileInfo } from '../../../../lib/types/files'
import { Button } from '../../../shared/basic/Button'
import { TextViewer } from '../../../shared/featured/fileviewers/TextViewer'
import { getFileCategory } from '../../../shared/lib/file-handlers'
import { useAppOperation } from '../../ViewContext'

interface FileContentProps {
  path: string | null
  content: string | null
  fileInfo: FileInfo | null
  loading: boolean
  error: string | null
}

export function FileContent({
  path,
  content,
  fileInfo,
  loading,
  error,
}: FileContentProps) {
  const execOp = useAppOperation()

  if (!path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground select-none">
        <div className="text-4xl font-bold mb-2 opacity-20">Aynite</div>
        <div className="text-xs tracking-widest uppercase opacity-20 mb-8">
          No file open
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={() => execOp(AppOperation.SWITCH_FILE)}
          className="gap-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
        >
          <Plus size={16} />
          <span>Select File</span>
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
          <div className="text-lg font-bold mb-2">Error</div>
          <div className="text-sm opacity-80">{error}</div>
        </div>
      </div>
    )
  }

  if (!fileInfo) return null

  const category = getFileCategory(
    fileInfo.extension,
    fileInfo.isText,
    fileInfo.path,
  )

  if (category === 'text' || category === 'html' || category === 'markdown') {
    return (
      <TextViewer content={content || ''} file={fileInfo} className="flex-1" />
    )
  }

  const Handler =
    FileHandlerComponents[category] || FileHandlerComponents.unsupported

  return (
    <div className="flex-1 overflow-hidden relative">
      <Handler file={fileInfo} content={content || undefined} />
    </div>
  )
}
