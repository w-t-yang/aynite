import { FileHandlerComponents } from '../../../../lib/constants/renderer/ui'
import type { FileInfo } from '../../../../lib/types/files'
import { TextViewer } from '../../../shared/featured/fileviewers/TextViewer'
import { getFileCategory } from '../../../shared/lib/file-handlers'

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
  if (!path) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-30 select-none">
        <div className="text-4xl font-bold mb-2">Aynite</div>
        <div className="text-xs tracking-widest uppercase">No file open</div>
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
